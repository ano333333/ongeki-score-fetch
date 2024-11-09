terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

locals {
  # docker host
  docker_host = "https://${var.region}-docker.pkg.dev"
}

provider "docker" {
  registry_auth {
    address = local.docker_host
  }
}

data "google_project" "project" {
  project_id = var.project_id
}

resource "random_id" "random_suffix" {
  byte_length = 4
}

locals {
  # 環境変数に基づいてsuffixを決定
  suffix = var.env != "" ? var.env : random_id.random_suffix.hex
}

# Artifact Registry APIの有効化
resource "google_project_service" "artifact_registry_api" {
  service = "artifactregistry.googleapis.com"
}

# Cloud Run APIの有効化
resource "google_project_service" "cloud_run_api" {
  service = "run.googleapis.com"
}

# Cloud Scheduler APIの有効化
resource "google_project_service" "cloud_scheduler_api" {
  service = "cloudscheduler.googleapis.com"
}

locals {
  # リポジトリのuri
  repository_uri = "${google_artifact_registry_repository.sheet_scraper_repository.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.sheet_scraper_repository.name}"
  # イメージのuri
  image_uri = "${local.repository_uri}/sheet-scraper-image:latest"
}

# Artifact Registryリポジトリ
resource "google_artifact_registry_repository" "sheet_scraper_repository" {
  repository_id = "sheet-scraper-repository-${local.suffix}"
  location      = var.region
  format        = "DOCKER"

  depends_on = [google_project_service.artifact_registry_api]
}

# docker imageビルド
resource "docker_image" "sheet_scraper_image" {
  name         = local.image_uri
  platform     = "linux/amd64"
  keep_locally = true

  build {
    context = "./sheet-scraper"
  }
}

# docker image push
resource "docker_registry_image" "sheet_scraper_image" {
  name = docker_image.sheet_scraper_image.name

  depends_on = [docker_image.sheet_scraper_image]
}

output "suffix" {
  value = local.suffix
}
