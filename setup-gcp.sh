#!/bin/bash

###############################################################################
# GCP Project Setup Script for Gene Guide AI
# One-time setup to prepare GCP project for Cloud Run deployment
# Creates required APIs, service accounts, and IAM roles
# Usage: ./setup-gcp.sh <GCP_PROJECT_ID>
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

PROJECT_ID="${1}"

if [ -z "$PROJECT_ID" ]; then
    error "GCP Project ID is required. Usage: ./setup-gcp.sh <GCP_PROJECT_ID>"
fi

log "Setting up GCP project for Gene Guide AI"
log "Project ID: $PROJECT_ID"

# Set project
gcloud config set project "$PROJECT_ID"

# Get project number
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
log "Project number: $PROJECT_NUMBER"

# Enable required APIs
log "Enabling required Google Cloud APIs..."

APIS=(
    "run.googleapis.com"           # Cloud Run
    "cloudbuild.googleapis.com"    # Cloud Build for CI/CD
    "artifactregistry.googleapis.com"  # Artifact Registry
    "compute.googleapis.com"       # Compute Engine
    "logging.googleapis.com"       # Cloud Logging
)

for api in "${APIS[@]}"; do
    log "Enabling $api..."
    gcloud services enable "$api" --quiet
done

success "All required APIs enabled"

# Create service account for Cloud Run
SERVICE_ACCOUNT="gene-guide-cloud-run"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"

log "Creating service account $SERVICE_ACCOUNT..."
gcloud iam service-accounts create "$SERVICE_ACCOUNT" \
    --display-name="Gene Guide Cloud Run Service Account" \
    --quiet 2>/dev/null || log "Service account already exists"

# Grant necessary IAM roles
log "Granting IAM roles..."

ROLES=(
    "roles/run.developer"              # Cloud Run deploy access
    "roles/artifactregistry.reader"    # Artifact Registry read
    "roles/logging.logWriter"          # Cloud Logging write
)

for role in "${ROLES[@]}"; do
    log "Granting $role..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="$role" \
        --quiet 2>/dev/null || log "Role already assigned"
done

success "IAM roles configured"

# Create cloud build service account (optional but recommended)
log "Configuring Cloud Build service account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/run.admin" \
    --quiet 2>/dev/null || true

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser" \
    --quiet 2>/dev/null || true

success "Cloud Build configured"

# Display summary
echo ""
echo "═══════════════════════════════════════════════════════════════"
success "GCP Project Setup Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Project Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Project Number: $PROJECT_NUMBER"
echo "  Service Account: $SERVICE_ACCOUNT_EMAIL"
echo ""
echo "Enabled APIs:"
for api in "${APIS[@]}"; do
    echo "  ✓ $api"
done
echo ""
echo "Next steps:"
echo "  1. Configure .env with your application secrets"
echo "  2. Run: ./deploy-gcp.sh $PROJECT_ID"
echo ""
