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
  image_uri = "${local.repository_uri}/sheet-scraper-image"
}

# Artifact Registryリポジトリ
resource "google_artifact_registry_repository" "sheet_scraper_repository" {
  repository_id = "sheet-scraper-repository-${local.suffix}"
  location      = var.region
  format        = "DOCKER"

  depends_on = [google_project_service.artifact_registry_api]
}

# imageのリビルド判定用に、sheet-scraper/をzip化
data "archive_file" "sheet_scraper_zip" {
  type        = "zip"
  source_dir  = "./sheet-scraper"
  output_path = "./sheet-scraper.zip"
  excludes    = ["node_modules", "dist/**", "auth.json"]
}

# docker imageビルド
resource "docker_image" "sheet_scraper_image" {
  name         = local.image_uri
  platform     = "linux/amd64"
  keep_locally = true

  build {
    context = "./sheet-scraper"
  }

  triggers = {
    sha256 = data.archive_file.sheet_scraper_zip.output_sha256
  }
}

# docker image push
resource "docker_registry_image" "sheet_scraper_image" {
  name = docker_image.sheet_scraper_image.name

  triggers = {
    sha256 = data.archive_file.sheet_scraper_zip.output_sha256
  }

  depends_on = [docker_image.sheet_scraper_image]
}

# Cloud Run用サービスアカウントの作成
resource "google_service_account" "sheet_scraper_sa" {
  account_id   = "sheet-scraper-${local.suffix}"
  display_name = "Service account for Cloud Run sheet-scraper"
}

# Cloud Runサービス
resource "google_cloud_run_service" "sheet_scraper" {
  name     = "sheet-scraper-${local.suffix}"
  location = var.region

  template {
    spec {
      containers {
        image = local.image_uri
      }
      service_account_name = google_service_account.sheet_scraper_sa.email
    }
  }

  autogenerate_revision_name = true

  traffic {
    latest_revision = true
    percent         = 100
  }

  depends_on = [google_project_service.cloud_run_api, google_service_account.sheet_scraper_sa, docker_registry_image.sheet_scraper_image]
}


output "suffix" {
  value = local.suffix
}
