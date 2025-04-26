terraform {
  required_providers {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

data "google_project" "project" {
  project_id = var.project_id
}

resource "random_id" "random_suffix" {
  byte_length = 4
}

locals {
  suffix = var.env != "" ? var.env : random_id.random_suffix.hex
}

output "suffix" {
  value = local.suffix
}
