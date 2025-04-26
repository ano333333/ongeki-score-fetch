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
