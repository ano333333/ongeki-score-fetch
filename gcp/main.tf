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
          value = "sheet-storage-${local.suffix}"
        }
        env {
          name  = "CURRENT_ONGEKI_VERSION_NAME"
          value = var.current_ongeki_version_name
        }
        resources {
          limits = {
            memory = "2Gi"
          }
        }
      }
      service_account_name = google_service_account.sheet_scraper_sa.email
      timeout_seconds      = 1200
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

  force_destroy = true

  uniform_bucket_level_access = true
}

# sheet-storageのallUsersに対する読み取り権限
resource "google_storage_bucket_iam_member" "sheet_storage_all_users_reader" {
  bucket = google_storage_bucket.sheet_storage.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# cloud runサービスアカウントに対する、sheet-storageへのstorage.objectAdminロール
resource "google_storage_bucket_iam_member" "sheet_storage_service_account_admin" {
  bucket = google_storage_bucket.sheet_storage.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.sheet_scraper_sa.email}"
}

# sheet-scraperを起動するeventarcに紐付けるpub/subトピック
resource "google_pubsub_topic" "sheet_scraper_topic" {
  name = "sheet-scraper-topic-${local.suffix}"
}

# sheet-scraperを起動するeventarcに紐付けるpub/subサブスクリプションのIAMロール
resource "google_service_account" "sheet_scraper_subscription_sa" {
  account_id   = "sheet-scraper-sub-sa-${local.suffix}"
  display_name = "Service account for pub/sub subscription to Cloud Run sheet-scraper"
}

# sheet_scraper_subscription_saにcloud runサービスのinvokerロールを付与
resource "google_cloud_run_service_iam_member" "sheet_scraper_invoker" {
  service  = google_cloud_run_service.sheet_scraper.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.sheet_scraper_subscription_sa.email}"
}

# sheet-scraperを起動するeventarcに紐付けるpub/subサブスクリプション
resource "google_pubsub_subscription" "sheet_scraper_subscription" {
  name                 = "sheet-scraper-subscription-${local.suffix}"
  topic                = google_pubsub_topic.sheet_scraper_topic.id
  ack_deadline_seconds = 600
  push_config {
    oidc_token {
      service_account_email = google_service_account.sheet_scraper_subscription_sa.email
    }
    push_endpoint = google_cloud_run_service.sheet_scraper.status[0].url
  }
  retry_policy {
    minimum_backoff = "600s"
  }
}

#  sheet_scraper_triggerを起動するscheduler
resource "google_cloud_scheduler_job" "sheet_scraper_scheduler" {
  name      = "sheet-scraper-scheduler-${local.suffix}"
  schedule  = var.sheet_scraper_schedule
  time_zone = "Asia/Tokyo"

  pubsub_target {
    topic_name = google_pubsub_topic.sheet_scraper_topic.id
    data       = base64encode(jsonencode({}))
  }
}

output "suffix" {
  value = local.suffix
}
