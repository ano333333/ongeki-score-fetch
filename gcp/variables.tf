variable "project_id" {
  description = "GCPプロジェクトID"
  type        = string
}

variable "region" {
  description = "リソースのリージョン"
  type        = string
}

variable "env" {
  description = "prd/stg/(空白)"
  type        = string
}

variable "sega_user_name" {
  description = "セガユーザー名(sheet-scraperで使用)"
  type        = string
}

variable "sega_password" {
  description = "セガパスワード(sheet-scraperで使用)"
  type        = string
}

variable "spread_sheet_id" {
  description = "スプレッドシートID(sheet-scraperで使用)"
  type        = string
}

variable "current_ongeki_version_name" {
  description = "現在のオンゲキのバージョン名"
  type        = string
}

variable "sheet_scraper_schedule" {
  description = "sheet-scraperのcron形式実行スケジュール(\"5 7 * * *\"など)"
  type        = string
}
