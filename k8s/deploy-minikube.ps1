# Minikube 1-Click Deployment Script
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Mogili Sai Shanmukha Vardhan - Portfolio Minikube Deploy" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check if minikube is running
Write-Host "`n[1/5] Checking Minikube status..." -ForegroundColor Yellow
$status = minikube status 2>&1
if ($status -notmatch "Running") {
    Write-Host "Starting Minikube cluster..." -ForegroundColor Green
    minikube start --driver=docker --cpus=2 --memory=4096
}

# 2. Point Docker CLI to Minikube's Docker daemon
Write-Host "`n[2/5] Configuring environment to use Minikube's Docker daemon..." -ForegroundColor Yellow
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# 3. Build Docker images inside Minikube
Write-Host "`n[3/5] Building Docker images inside Minikube..." -ForegroundColor Yellow
docker build -t portfolio-backend:latest ./server
docker build -t portfolio-frontend:latest .

# 4. Apply Kubernetes Manifests
Write-Host "`n[4/5] Applying Kubernetes manifests..." -ForegroundColor Yellow
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secrets.yaml
kubectl apply -f k8s/03-backend-deployment.yaml
kubectl apply -f k8s/04-backend-service.yaml
kubectl apply -f k8s/05-frontend-deployment.yaml
kubectl apply -f k8s/06-frontend-service.yaml
kubectl apply -f k8s/07-ingress.yaml
kubectl apply -f k8s/monitoring/

# 5. Wait for rollout
Write-Host "`n[5/5] Waiting for pods to be ready..." -ForegroundColor Yellow
kubectl rollout status deployment/portfolio-backend -n portfolio-devops --timeout=90s
kubectl rollout status deployment/portfolio-frontend -n portfolio-devops --timeout=90s

Write-Host "`n Deployment complete!" -ForegroundColor Green
Write-Host "Opening portfolio frontend service in browser..." -ForegroundColor Cyan
minikube service portfolio-frontend -n portfolio-devops
