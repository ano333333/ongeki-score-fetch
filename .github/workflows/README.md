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
