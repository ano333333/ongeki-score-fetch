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

variable "spreadsheet_id" {
  description = "スプレッドシートID(sheet-scraperで使用)"
  type        = string
}
