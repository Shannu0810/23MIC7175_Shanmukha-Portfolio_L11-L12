terraform {
  required_version = ">= 1.5.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24.0"
    }
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}

# 1. Namespace
resource "kubernetes_namespace" "portfolio" {
  metadata {
    name = var.app_namespace
    labels = {
      "app.kubernetes.io/name"       = "portfolio"
      "app.kubernetes.io/managed-by" = "terraform"
    }
  }
}

# 2. ConfigMap
resource "kubernetes_config_map" "portfolio_config" {
  metadata {
    name      = "portfolio-config"
    namespace = kubernetes_namespace.portfolio.metadata[0].name
  }

  data = {
    NODE_ENV         = "production"
    PORT             = "5000"
    FRONTEND_URL     = "http://portfolio.local"
    MFA_SERVICE_NAME = "SaiShanmukhaPortfolio"
    MFA_WINDOW       = "1"
    LOG_LEVEL        = "info"
  }
}

# 3. Secret
resource "kubernetes_secret" "portfolio_secrets" {
  metadata {
    name      = "portfolio-secrets"
    namespace = kubernetes_namespace.portfolio.metadata[0].name
  }

  data = {
    GOOGLE_CLIENT_ID     = var.google_client_id
    GOOGLE_CLIENT_SECRET = var.google_client_secret
    JWT_SECRET           = var.jwt_secret
    JIRA_API_TOKEN       = var.jira_api_token
  }

  type = "Opaque"
}

# 4. Backend Deployment
resource "kubernetes_deployment" "backend" {
  metadata {
    name      = "portfolio-backend"
    namespace = kubernetes_namespace.portfolio.metadata[0].name
    labels = {
      app = "portfolio-backend"
    }
  }

  spec {
    replicas = var.backend_replicas

    selector {
      match_labels = {
        app = "portfolio-backend"
      }
    }

    template {
      metadata {
        labels = {
          app = "portfolio-backend"
        }
        annotations = {
          "prometheus.io/scrape" = "true"
          "prometheus.io/port"   = "5000"
          "prometheus.io/path"   = "/metrics"
        }
      }

      spec {
        container {
          image             = "portfolio-backend:latest"
          name              = "auth-backend"
          image_pull_policy = "IfNotPresent"

          port {
            container_port = 5000
            name           = "http"
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.portfolio_config.metadata[0].name
            }
          }

          env {
            name = "GOOGLE_CLIENT_ID"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.portfolio_secrets.metadata[0].name
                key  = "GOOGLE_CLIENT_ID"
              }
            }
          }

          env {
            name = "GOOGLE_CLIENT_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.portfolio_secrets.metadata[0].name
                key  = "GOOGLE_CLIENT_SECRET"
              }
            }
          }

          env {
            name = "JWT_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.portfolio_secrets.metadata[0].name
                key  = "JWT_SECRET"
              }
            }
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "300m"
              memory = "256Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 5000
            }
            initial_delay_seconds = 10
            period_seconds        = 15
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = 5000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }
        }
      }
    }
  }
}

# 5. Backend Service
resource "kubernetes_service" "backend" {
  metadata {
    name      = "portfolio-backend"
    namespace = kubernetes_namespace.portfolio.metadata[0].name
  }

  spec {
    selector = {
      app = kubernetes_deployment.backend.metadata[0].labels.app
    }

    port {
      port        = 5000
      target_port = 5000
      name        = "http"
    }

    type = "ClusterIP"
  }
}

# 6. Frontend Deployment
resource "kubernetes_deployment" "frontend" {
  metadata {
    name      = "portfolio-frontend"
    namespace = kubernetes_namespace.portfolio.metadata[0].name
    labels = {
      app = "portfolio-frontend"
    }
  }

  spec {
    replicas = var.frontend_replicas

    selector {
      match_labels = {
        app = "portfolio-frontend"
      }
    }

    template {
      metadata {
        labels = {
          app = "portfolio-frontend"
        }
      }

      spec {
        container {
          image             = "portfolio-frontend:latest"
          name              = "frontend-nginx"
          image_pull_policy = "IfNotPresent"

          port {
            container_port = 80
            name           = "http"
          }

          resources {
            requests = {
              cpu    = "50m"
              memory = "64Mi"
            }
            limits = {
              cpu    = "150m"
              memory = "128Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 5
            period_seconds        = 15
          }
        }
      }
    }
  }
}

# 7. Frontend Service
resource "kubernetes_service" "frontend" {
  metadata {
    name      = "portfolio-frontend"
    namespace = kubernetes_namespace.portfolio.metadata[0].name
  }

  spec {
    selector = {
      app = kubernetes_deployment.frontend.metadata[0].labels.app
    }

    port {
      port        = 80
      target_port = 80
      node_port   = 30080
      name        = "http"
    }

    type = "NodePort"
  }
}
