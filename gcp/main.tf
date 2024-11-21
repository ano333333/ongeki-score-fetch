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
        env {
          name  = "SEGA_USER_NAME"
          value = var.sega_user_name
        }
        env {
          name  = "SEGA_PASSWORD"
          value = var.sega_password
        }
        env {
          name  = "SPREAD_SHEET_ID"
          value = var.spread_sheet_id
        }
        env {
          name  = "SHEET_STORAGE_NAME"
          value = google_storage_bucket.sheet_storage.name
        }
      }
      service_account_name = google_service_account.sheet_scraper_sa.email
    }
  }

  autogenerate_revision_name = true

  traffic {
    latest_revision = true
    percent         = 100
  }

  depends_on = [google_service_account.sheet_scraper_sa, docker_registry_image.sheet_scraper_image]
}

# イメージデプロイで"gcloud run deploy"を実行するためのコマンド
resource "terraform_data" "deploy_command" {
  triggers_replace = [docker_image.sheet_scraper_image]

  provisioner "local-exec" {
    command = "gcloud run deploy ${google_cloud_run_service.sheet_scraper.name} --image=${local.image_uri}:latest --region=${var.region}"
  }
}


# 譜面情報保存用のCloud Storageバケット
resource "google_storage_bucket" "sheet_storage" {
  name     = "sheet-storage-${local.suffix}"
  location = var.region

  uniform_bucket_level_access = true
}

# sheet-storageのallUsersに対する読み取り権限
resource "google_storage_bucket_iam_member" "sheet_storage_all_users_reader" {
  bucket = google_storage_bucket.sheet_storage.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# cloud runサービスアカウントに対する、sheet-storageへのstorage.objects.create権限
resource "google_storage_bucket_iam_member" "sheet_storage_service_account_creator" {
  bucket = google_storage_bucket.sheet_storage.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${google_service_account.sheet_scraper_sa.email}"
}


output "suffix" {
  value = local.suffix
}
