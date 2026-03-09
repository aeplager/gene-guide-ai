#!/bin/bash
# =============================================================================
# GCP Cloud Run Deployment Script (Bash - Linux/Mac)
# =============================================================================
# This script builds a Docker image locally, pushes to Google Container Registry,
# and deploys to Cloud Run with environment variables from an env file.
#
# USAGE:
#   ./deploy-gcp.sh [PROJECT_ID] [SERVICE_NAME] [REGION] [MEMORY] [CPU] [DEPLOY_FRONTEND] [ENV_FILE]
#
# EXAMPLES:
#   ./deploy-gcp.sh
#   ./deploy-gcp.sh my-gcp-project
#   ./deploy-gcp.sh my-gcp-project legacy-forever-api us-central1 4Gi 4
#   ./deploy-gcp.sh my-gcp-project gene-guide-api us-central1 512Mi 1 true .env.gcp
#
# PREREQUISITES:
#   1. gcloud CLI installed and authenticated (gcloud auth login)
#   2. .env (default) or .env.gcp exists in the project directory
#   3. Dockerfile.backend exists in the project directory
# =============================================================================

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
SERVICE_NAME="${2:-gene-guide-api}"
REGION="${3:-us-central1}"
MEMORY="${4:-512Mi}"
CPU="${5:-1}"
DOCKERFILE="Dockerfile.backend"
PORT="8081"
ENV_FILE=".env"
CLOUD_SQL_CONNECTION="chief-of-staff-480821:us-central1:sopheri"
DEPLOY_FRONTEND="${6:-true}"
FRONTEND_SERVICE_NAME="gene-guide-web"
ENV_FILE_EXPLICIT=false

if [ -n "${7:-}" ]; then
    ENV_FILE="$7"
    ENV_FILE_EXPLICIT=true
fi

# =============================================================================
# Helper Functions
# =============================================================================

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

print_header() {
    echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}\n"
}

# =============================================================================
# Validation
# =============================================================================

print_header "GCP Cloud Run Deployment Script"

# Resolve project ID in this order:
# 1) Explicit first argument
# 2) GCP_PROJECT_ID environment variable
# 3) Active gcloud CLI project
# 4) Repository fallback project
PROJECT_ID="${1:-${GCP_PROJECT_ID:-}}"

if [ -z "$PROJECT_ID" ] && command -v gcloud &> /dev/null; then
    PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
fi

if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID="chief-of-staff-480821"
    print_warning "No PROJECT_ID provided and no active gcloud project found. Falling back to: $PROJECT_ID"
fi

print_info "Configuration:"
echo "  Project ID:    $PROJECT_ID"
echo "  Service Name:  $SERVICE_NAME"
echo "  Region:        $REGION"
echo "  Memory:        $MEMORY"
echo "  CPU:           $CPU"
echo "  Dockerfile:    $DOCKERFILE"
echo "  Port:          $PORT"
echo "  Deploy Frontend: $DEPLOY_FRONTEND"
echo "  Env File:      $ENV_FILE"
echo ""

# Check env file with backward-compatible fallback
if [ ! -f "$ENV_FILE" ]; then
    if [ "$ENV_FILE_EXPLICIT" = false ] && [ -f ".env.gcp" ]; then
        print_warning ".env not found; falling back to .env.gcp"
        ENV_FILE=".env.gcp"
    else
        print_error "$ENV_FILE file not found! Please create it before deploying."
    fi
fi

print_success "$ENV_FILE file found"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI is not installed. Please install it from https://cloud.google.com/sdk/docs/install"
fi

print_success "gcloud CLI is installed"

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE" ]; then
    print_error "$DOCKERFILE not found!"
fi

print_success "$DOCKERFILE found"

# =============================================================================
# Environment Variables Extraction
# =============================================================================

print_header "Step 1: Extracting Environment Variables"

print_info "Reading environment variables from $ENV_FILE..."

# Extract environment variables from .env file
# - Skip empty lines
# - Skip comments (lines starting with #)
# - Handle special characters properly
# - Handle duplicate keys (last occurrence wins)
declare -A ENV_MAP

while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines
    if [ -z "$line" ]; then
        continue
    fi
    
    # Skip comments (lines starting with #)
    if [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # Skip lines without '=' 
    if [[ ! "$line" =~ = ]]; then
        continue
    fi
    
    # Extract key and value
    key="${line%%=*}"
    value="${line#*=}"
    
    # Trim whitespace from key
    key=$(echo "$key" | xargs)
    
    # Skip if key is empty
    if [ -z "$key" ]; then
        continue
    fi
    
    # Remove inline comments from value (but preserve # in passwords/URLs)
    # Only remove comments that are preceded by whitespace
    if [[ "$value" =~ ^(.+)[[:space:]]+#.*$ ]]; then
        value="${BASH_REMATCH[1]}"
        value=$(echo "$value" | sed 's/[[:space:]]*$//')  # Trim trailing whitespace
    fi
    
    # Remove Windows carriage return characters (important for Windows files)
    value=$(echo "$value" | tr -d '\r')
    
    # Store in associative array (overwrites duplicates automatically)
    ENV_MAP["$key"]="$value"
    
done < "$ENV_FILE"

# Convert associative array to regular array for deployment
ENV_VARS=()
for key in "${!ENV_MAP[@]}"; do
    ENV_VARS+=("$key=${ENV_MAP[$key]}")
done

print_success "Extracted ${#ENV_VARS[@]} unique environment variables"

# Validate common placeholder values to avoid broken Cloud Run deploys.
if [ -n "${ENV_MAP[CORS_ORIGINS]:-}" ] && [[ "${ENV_MAP[CORS_ORIGINS]}" == *"PROJECT_NUMBER"* || "${ENV_MAP[CORS_ORIGINS]}" == *"your-project"* || "${ENV_MAP[CORS_ORIGINS]}" == *"example"* ]]; then
    print_error "CORS_ORIGINS appears to contain placeholder values in $ENV_FILE (${ENV_MAP[CORS_ORIGINS]})."
fi

if [ -n "${ENV_MAP[VITE_TAVUS_BACKEND_URL]:-}" ] && [[ "${ENV_MAP[VITE_TAVUS_BACKEND_URL]}" == *"PROJECT_NUMBER"* || "${ENV_MAP[VITE_TAVUS_BACKEND_URL]}" == *"your-project"* || "${ENV_MAP[VITE_TAVUS_BACKEND_URL]}" == *"example"* ]]; then
    print_error "VITE_TAVUS_BACKEND_URL appears to contain placeholder values in $ENV_FILE (${ENV_MAP[VITE_TAVUS_BACKEND_URL]})."
fi

# Debug: Show first few variables (without sensitive values)
print_info "Sample variables extracted (keys only):"
for i in {0..2}; do
    if [ $i -lt ${#ENV_VARS[@]} ]; then
        key="${ENV_VARS[$i]%%=*}"
        echo "  - $key"
    fi
done

# =============================================================================
# Cloud Run Deployment (Direct from Source)
# =============================================================================

print_header "Step 2: Deploying to Cloud Run from Source"

print_info "Deploying service: $SERVICE_NAME"
print_info "Region: $REGION"
print_info "Building and deploying from source (using Cloud Build)"

# Build the gcloud deploy command with environment variables
DEPLOY_CMD=(
    gcloud run deploy "$SERVICE_NAME"
    --source=.
    --clear-base-image
    --platform=managed
    --region="$REGION"
    --memory="$MEMORY"
    --cpu="$CPU"
    --port="$PORT"
    --allow-unauthenticated
    --project="$PROJECT_ID"
    --max-instances=10
    --min-instances=0
    --timeout=300
    --add-cloudsql-instances="$CLOUD_SQL_CONNECTION"
)

# Add environment variables with proper quoting
# Each variable is passed separately to avoid shell interpretation issues
for env_var in "${ENV_VARS[@]}"; do
    DEPLOY_CMD+=(--set-env-vars)
    DEPLOY_CMD+=("$env_var")
done

print_info "Executing deployment command..."
print_info "This may take 2-5 minutes..."

# Execute the deployment
if "${DEPLOY_CMD[@]}"; then
    print_success "Deployment completed successfully!"
else
    print_error "Deployment failed"
fi

# =============================================================================
# Frontend Deployment (Optional)
# =============================================================================

if [ "$DEPLOY_FRONTEND" = "true" ]; then
    print_header "Step 3: Deploying Frontend to Cloud Run"
    
    print_info "Deploying frontend service: $FRONTEND_SERVICE_NAME"
    print_info "Building and deploying frontend from source..."
    
    # Get backend URL for frontend configuration
    BACKEND_URL=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(status.url)" 2>/dev/null || echo "")
    
    if [ -z "$BACKEND_URL" ]; then
        print_warning "Could not retrieve backend URL. Using default configuration."
        BACKEND_URL="https://$SERVICE_NAME-$REGION.run.app"
    fi
    
    # Extract VAPI key from environment variables
    VAPI_KEY=""
    for env_var in "${ENV_VARS[@]}"; do
        if [[ "$env_var" =~ ^VITE_VAPI_PUBLIC_KEY= ]]; then
            VAPI_KEY="${env_var#*=}"
            break
        fi
    done
    
    if [ -z "$VAPI_KEY" ]; then
        print_warning "VITE_VAPI_PUBLIC_KEY not found in $ENV_FILE"
    fi
    
    # Build the frontend image first using Cloud Build
    IMAGE_NAME="gcr.io/$PROJECT_ID/${FRONTEND_SERVICE_NAME}:latest"
    
    print_info "Building frontend image with Cloud Build..."
    
    # Create temporary cloudbuild.yaml for frontend with build args
    cat > /tmp/cloudbuild-frontend.yaml <<EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '$IMAGE_NAME'
      - '-f'
      - 'Dockerfile.frontend'
      - '--build-arg'
      - 'VITE_TAVUS_BACKEND_URL=$BACKEND_URL'
      - '--build-arg'
      - 'VITE_VAPI_PUBLIC_KEY=$VAPI_KEY'
      - '.'
images:
  - '$IMAGE_NAME'
EOF
    
    if ! gcloud builds submit --config=/tmp/cloudbuild-frontend.yaml --project="$PROJECT_ID" --region="$REGION" .; then
        print_error "Frontend image build failed"
    fi
    
    # Cleanup temp file
    rm -f /tmp/cloudbuild-frontend.yaml
    
    print_success "Frontend image built successfully!"
    
    # Deploy the frontend image
    print_info "Deploying frontend to Cloud Run..."
    
    FRONTEND_DEPLOY_CMD=(
        gcloud run deploy "$FRONTEND_SERVICE_NAME"
        --image="$IMAGE_NAME"
        --platform=managed
        --region="$REGION"
        --memory="$MEMORY"
        --cpu="$CPU"
        --port=80
        --allow-unauthenticated
        --project="$PROJECT_ID"
        --max-instances=10
        --min-instances=0
        --timeout=300
    )
    
    print_info "Executing frontend deployment..."
    
    if "${FRONTEND_DEPLOY_CMD[@]}"; then
        print_success "Frontend deployment completed successfully!"
    else
        print_error "Frontend deployment failed"
    fi
fi

# =============================================================================
# Post-Deployment Information
# =============================================================================

print_header "Deployment Summary"

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(status.url)" 2>/dev/null || echo "Unable to retrieve URL")

print_success "Backend service deployed successfully!"
echo ""
echo "  Service Name:  $SERVICE_NAME"
echo "  Region:        $REGION"
echo "  Project:       $PROJECT_ID"
echo "  Source:        . (current directory)"
echo "  Memory:        $MEMORY"
echo "  CPU:           $CPU"
echo "  Cloud SQL:     $CLOUD_SQL_CONNECTION"
echo ""
echo "  Service URL:   $SERVICE_URL"
echo ""

if [ "$DEPLOY_FRONTEND" = "true" ]; then
    # Get the frontend service URL
    FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(status.url)" 2>/dev/null || echo "Unable to retrieve URL")
    
    print_success "Frontend service deployed successfully!"
    echo ""
    echo "  Service Name:  $FRONTEND_SERVICE_NAME"
    echo "  Frontend URL:  $FRONTEND_URL"
    echo ""
fi
print_info "You can view logs with:"
echo "  gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --limit 50 --project=$PROJECT_ID"
echo ""
print_info "You can view the service in the console:"
echo "  https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/metrics?project=$PROJECT_ID"
echo ""

print_success "Deployment complete! 🚀"
