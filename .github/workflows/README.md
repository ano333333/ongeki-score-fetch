# GitHub Actions

## カスタムDockerイメージ

### 概要

GitHub Actionsの実行時間短縮を目的として、Node.jsとPlaywrightがプリインストールされたカスタムDockerイメージを提供する。

### 目的・背景

#### 課題

- GitHub Actionsでの`npx install playwright`処理が重く、実行時間が長時間化
- 各ジョブでのNode.jsセットアップ処理の重複実行
- ビルド時間の最適化が必要

#### 解決アプローチ

- Node.jsとPlaywrightがプリインストールされたDockerイメージを事前作成
- Composite Actionからnodeセットアップとplaywright install処理を削除

### Dockerイメージ仕様

#### ongeki-score-fetch/node:24.04

**基盤**: Ubuntu 24.04 LTS  
**Node.js**: v22 (LTS)  
**追加パッケージ**: curl, unzip, git

**用途**:

- Chrome Extension ビルド処理
- Sheet Scraper テスト実行

#### ongeki-score-fetch/playwright:24.04

**基盤**: Ubuntu 24.04 LTS  
**Node.js**: v22 (LTS)  
**Playwright**: プリインストール（ブラウザ込み）  
**追加パッケージ**: curl, unzip, git

**特徴**:

- Playwright関連依存関係を事前インストール
- ブラウザバイナリ（Chromium）を含有
- `npx playwright install --with-deps`実行済み

**用途**:

- E2Eテスト実行

### ビルド手順

#### 前提条件

- Docker Engine インストール済み環境
- GitHub Container Registryへのアクセス権限

#### ローカルビルドとpush

```bash
# Node.jsイメージのビルド
cd .github/workflows/images
docker build -f Dockerfile.node -t ghcr.io/ano333333/ongeki-score-fetch/node:24.04 .
docker push ghcr.io/ano333333/ongeki-score-fetch/node:24.04

# Playwrightイメージのビルド
docker build -f Dockerfile.playwright -t ghcr.io/ano333333/ongeki-score-fetch/playwright:24.04 .
docker push ghcr.io/ano333333/ongeki-score-fetch/playwright:24.04
```

### GitHub Actionsでの使用方法

```yaml
        runs-on: ubuntu-24.04
        container:
            image: ghcr.io/ano333333/ongeki-score-fetch/playwright:24.04
            credentials:
                username: ${{ github.actor }}
                password: ${{ secrets.CR_PAT }}
```

### 運用上の注意事項

#### Terraform関連ジョブの扱い

Terraform関連ジョブでは、Docker in Docker環境での認証問題を回避するため、カスタムイメージではなく公式`ubuntu:24.04`を使用する。

**対象ジョブ**:

- plan-terraform
- apply-terraform

## 環境変数管理

### 概要

環境変数は機密性に応じて **Repository Variables** と **Repository secrets** の2種類に分けて管理する。

### 機密性による分類基準

- **Repository secrets**: 認証情報やプロジェクト固有の機密データ
- **Repository Variables**: 設定値や公開されても問題ない情報

### 設定ファイル作成

Chrome Extensionの`.env`、Terraformの`terraform.tfvars`、Sheet Scraperの`.env`は、それぞれのComposite Actionで自動作成される。

- **Repository secrets**: inputパラメータとしてComposite Actionに渡す
- **Repository Variables**: Composite Action内部で直接参照する

### 設定が必要な変数一覧

#### Repository secrets

| 変数名 | 用途 | 説明 |
|--------|------|------|
| `SEGA_USER_NAME` | 認証 | SEGAユーザー名 |
| `SEGA_PASSWORD` | 認証 | SEGAパスワード |
| `WORKLOAD_IDENTITY_PROVIDER` | GCP認証 | Workload Identity Provider |
| `SERVICE_ACCOUNT_EMAIL` | GCP認証 | Service Account Email |
| `PROJECT_ID` | GCP | プロジェクト識別子 |
| `TERRAFORM_TFSTATE_BUCKET` | インフラ | Terraformステートファイル保存先 |
| `CR_PAT` | GitHub | Container Registry Personal Access Token |
| `GITHUB_TOKEN` | GitHub | GitHub Actions用トークン |

#### Repository Variables

| 変数名 | 用途 | 説明 |
|--------|------|------|
| `REGION` | GCP | デプロイリージョン |
| `SPREAD_SHEET_ID` | 機能 | Google Spreadsheet ID |
| `CURRENT_ONGEKI_VERSION_NAME` | 機能 | 現在のオンゲキバージョン名 |
| `CHROME_EXTENSION_BEATMAP_DATA_BUCKET_URL_STG` | Chrome Extension | STG環境Beatmapデータバケット URL |
| `CHROME_EXTENSION_BEATMAP_DATA_BUCKET_URL_PRD` | Chrome Extension | PRD環境Beatmapデータバケット URL |
| `CHROME_EXTENSION_BUILDS_BUCKET` | Chrome Extension | ビルド成果物保存バケット |
| `SHEET_STORAGE_NAME_STG` | Sheet Scraper | STG環境シートストレージ名 |
| `SHEET_SCRAPER_SCHEDULE_STG` | Terraform | STG環境スケジュール設定 |
| `SHEET_SCRAPER_SCHEDULE_PRD` | Terraform | PRD環境スケジュール設定 |

### Composite Action一覧

#### setup-chrome-extension-env

- **用途**: Chrome Extension用`.env`ファイル作成
- **入力**: `env` (stg/prd)
- **Repository Variables**: `CHROME_EXTENSION_BEATMAP_DATA_BUCKET_URL_STG/PRD`

#### setup-sheet-scraper-env

- **用途**: Sheet Scraper用`.env`ファイル作成（STG環境固定）
- **入力**: `sega-user-name`, `sega-password`
- **Repository Variables**: `SPREAD_SHEET_ID`, `SHEET_STORAGE_NAME_STG`, `CURRENT_ONGEKI_VERSION_NAME`

#### setup-terraform-vars

- **用途**: Terraform用`terraform.tfvars`ファイル作成
- **入力**: `env` (stg/prd), `project-id`, `sega-user-name`, `sega-password`
- **Repository Variables**: `REGION`, `SPREAD_SHEET_ID`, `CURRENT_ONGEKI_VERSION_NAME`, `SHEET_SCRAPER_SCHEDULE_STG/PRD`
