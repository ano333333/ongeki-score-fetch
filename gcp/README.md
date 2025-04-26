# README - GCP

## 概要

terraformによるGCPのリソース管理を行うためのリポジトリ

## 特に重要な注意点

- cloud run「sheet-scraper」の環境変数(.env)について。terraformのapply時、**terraform.tfvarsの値を引き継いでsheet-scraperの.envを作成する**ため、**sheet-scraperの.env内容を変更する際は.terraform.tfvarsの値も変更する**。またGithub Actionsでのapply用に、**Repository secretsを追加しワークフローを更新する**。

```text
# sheet-scraper/.env 中略...

# ########################################
# sheet-scraper/.env新しい環境変数を追加する場合、
# ########################################
NEW_ENV=
```

```tf
# variables.tf 中略...

# ########################################
# variables.tfに新しい変数定義を加え、
# ########################################
variable "sheet_scraper_new_env" {
    description = "新しい環境変数"
    type = string
}
```

```tfvars
# terraform.tfvars 中略...

# ########################################
# terraform.tfvarsに実際の値を記述する
# ########################################
sheet_scraper_new_env = "新しい環境変数の値"
```

```yaml
# .github/workflows/master-push.yaml 中略...

# ########################################
# ワークフローを更新する
# ########################################
# jobs: apply-terraform: steps: - name: "Copy variables.tf"
            - name: "Copy variables.tf"
              env:
                  PROJECT_ID: ${{secrets.PROJECT_ID}}
                  REGION: ${{secrets.REGION}}
                  ENV: "stg"
                  SHEET_SCRAPER_NEW_ENV: ${{secrets.SHEET_SCRAPER_NEW_ENV}}
              run: |
                  echo "project_id = \"$PROJECT_ID\"" > ./terraform.tfvars
                  echo "region = \"$REGION\"" >> ./terraform.tfvars
                  echo "env = \"$ENV\"" >> ./terraform.tfvars
                  echo "sheet_scraper_new_env = \"$SHEET_SCRAPER_NEW_ENV\"" >> ./terraform.tfvars

# master-pr.yamlのjobs: apply-new-env: steps: - name: "Copy variables.tf"と、
# release-push.yamlのjobs: apply-terraform: steps: -name: "Copy variables.tf"も同様に更新する。
```

## ディレクトリ構造

.gitignoreされるファイル/ディレクトリは、ファイル名先頭に「*」を付与している。

```text
gcp/
├ README.md
├ README.md.images/ # README.mdの画像ファイル
├ .gitignore
├ main.tf # リソース定義
├ variables.tf
├ *terraform.tfvars
├ *terraform.tfstate
├ *terraform.tfstate.backup
├ *terraform.lock.hcl
├ *.terraform/
├ *sheet-scraper.zip # terraform apply時自動生成
├ sheet-scraper/ # cloud run「sheet-scraper」のリポジトリ
   ├ codes/
   ├ package.json
   ├ pnpm-lock.yaml
   ├ tsconfig.json
   ├ .gitignore
   ├ *.env
   ├ env.example # .envの各項目の説明/例
   ├ Dockerfile # cloud run実行イメージ
   ├ *credentials.json # GCPリソースアクセスのための認証情報・ローカルデバッグで使用
   ├ *node_modules/
```

## terraformスタックのデプロイ

### 開発時テスト用

terraformのテストのために1スタックのみをデプロイする場合、

```bash
terraform init # 初回のみ
terraform apply
```

ここで生成されたリソースの名前末尾には、自動生成されたsuffixが付与され、そのsuffixは`terraform apply`時コンソールに表示される。

```text
Apply complete! Resources: 1 added, 0 changed, 0 destroyed.

Outputs:

suffix = "52cd46d0"
```

### テスト環境用

masterブランチへのPR作成時、Github Actionsが起動し、stgスタックに対してTerraformのplanを実行する。

またmasterブランチへのmerge時、Github Actionsが起動し、stgスタックに対してTerraformのapplyを実行する。

### 本番環境用

releaseブランチへマージすると、Github Actionsが起動し、prdスタックに対してTerraformのapplyを実行する。

## cloud runの開発環境について

### sheet-scraper

ディレクトリに移動し

```bash
npm run dev
```

でローカルサーバーを起動する。`http://localhost:8080`にPOSTリクエストを送信することで、譜面情報スクレイピングを開始する。ローカルサーバーの出力する`result.csv`は、cloud storage「sheet-storage-local」に保存される。

## terraformアーキテクチャについての詳細

### 各スタックの構成

![stacks](./README.md.images/stack-architecture.drawio.png)

- schedulerとPub/Subを用いてCloud Run(sheet-scraper)を起動し、スコアログのデータを取得する
- sheet-scraperはマイページと定数保管所の情報を取得し、sheet-storageに保存する
- sheet-scraperの実行イメージは、sheet-scraper-repositoryに保存する

### TerraformとGithub Actionsについて

リソースのデプロイはTerraformを用いて行う。各スタックには「prd」「stg」または4バイトのランダムな16進数の文字列を割り当て、各リソースの末尾に付与する。

masterブランチへのPRを作成するとGithub Actionsが起動し、stgスタックに対してTerraformのplanを実行する。masterブランチまたはreleaseブランチへのpushがあった場合は、Github Actionsが起動し、それぞれstg,prdスタックに対してTerraformのapplyを実行する。

.tfstatesファイルはCloud Storage(ongeki-score-log-tfstates)に、prd.tfstates,stg.tfstatesとして保存する。

![github-actions](./README.md.images/github-actions.drawio.png)
