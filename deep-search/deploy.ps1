# 🔥 ALLMIGHTY Deep Search Deployment Script (PowerShell)
# This script deploys the Deep Search platform to Google Cloud Run.

$PROJECT_ID = "project-3ca39165-fb2e-4579-84e"
$REGION = "us-central1"
$REPO_NAME = "deep-search-repo"
$IMAGE_NAME = "allmighty-deep-search"
$TAG = "latest"
$IMAGE_URL = "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG}"

Write-Host "🚀 Starting deployment for Project: $PROJECT_ID in Region: $REGION" -ForegroundColor Cyan

# 1. Configure gcloud to use the project
Write-Host "🔧 Configuring gcloud project..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# 2. Enable necessary Google Cloud services
Write-Host "📦 Enabling Google Cloud services..." -ForegroundColor Yellow
gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com

# 3. Create Artifact Registry repository if it doesn't exist
Write-Host "🏗️ Checking Artifact Registry repository..." -ForegroundColor Yellow
$repoExists = gcloud artifacts repositories list --location=$REGION --filter="name:projects/$PROJECT_ID/locations/$REGION/repositories/$REPO_NAME" --format="value(name)"
if (-not $repoExists) {
    Write-Host "Creating repository $REPO_NAME..." -ForegroundColor Yellow
    gcloud artifacts repositories create $REPO_NAME --repository-format=docker --location=$REGION --description="Docker repository for Deep Search" --quiet
}

# 4. Build and Push using Cloud Build (Most reliable for PowerShell/Windows)
Write-Host "🛠️ Building and pushing Docker image via Cloud Build..." -ForegroundColor Yellow
gcloud builds submit --tag $IMAGE_URL .

# 5. Deploy to Cloud Run
Write-Host "🚀 Deploying to Cloud Run..." -ForegroundColor Yellow
gcloud run deploy $IMAGE_NAME `
  --image $IMAGE_URL `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --memory 2Gi `
  --cpu 2 `
  --timeout 3600 `
  --concurrency 80 `
  --min-instances 0 `
  --max-instances 10 `
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,DATA_DIR=/app/data,MEMORY_DB_PATH=/app/data/memory.db,ENABLE_SCHEDULER=true,ENABLE_COMPETITIVE_INTEL=true"

Write-Host "✅ Deployment Complete!" -ForegroundColor Green
$serviceUrl = gcloud run services describe $IMAGE_NAME --region $REGION --format="value(status.url)"
Write-Host "🌐 Live URL: $serviceUrl" -ForegroundColor Green
