variable "kubeconfig_path" {
  description = "Path to local kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "app_namespace" {
  description = "Kubernetes namespace for the portfolio application"
  type        = string
  default     = "portfolio-devops"
}

variable "google_client_id" {
  description = "Google OAuth 2.0 Client ID"
  type        = string
}

variable "google_client_secret" {
  description = "Google OAuth 2.0 Client Secret"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT Secret for signing sessions"
  type        = string
  sensitive   = true
  default     = "super_secret_portfolio_jwt_key_914232904778_shanmukha_2026"
}

variable "jira_api_token" {
  description = "Atlassian Jira API token"
  type        = string
  sensitive   = true
  default     = "your_jira_api_token_here"
}

variable "frontend_replicas" {
  description = "Replica count for the frontend deployment"
  type        = number
  default     = 2
}

variable "backend_replicas" {
  description = "Replica count for the backend deployment"
  type        = number
  default     = 2
}
