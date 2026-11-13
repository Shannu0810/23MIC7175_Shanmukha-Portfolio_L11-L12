output "namespace" {
  description = "Kubernetes namespace created by Terraform"
  value       = kubernetes_namespace.portfolio.metadata[0].name
}

output "backend_service_name" {
  description = "Backend ClusterIP service name"
  value       = kubernetes_service.backend.metadata[0].name
}

output "frontend_service_nodeport" {
  description = "NodePort to access the frontend"
  value       = kubernetes_service.frontend.spec[0].port[0].node_port
}
