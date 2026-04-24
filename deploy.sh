#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Cloud Run Deploy Script for Padi Smart Aid
# Usage: ./deploy.sh
#
# IMPORTANT: Set all required environment variables before running.
# Copy .env.deploy.example to .env.deploy, fill in your values,
# then run: source .env.deploy && ./deploy.sh
# ─────────────────────────────────────────────────────────────

set -e

# ── CONFIG ───────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-asia-southeast1}"
SERVICE_NAME="${GCP_SERVICE_NAME:-padi-smart-aid}"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

# ── Validate required env vars ───────────────────────────────
: "${VITE_FIREBASE_API_KEY:?Missing VITE_FIREBASE_API_KEY}"
: "${VITE_FIREBASE_AUTH_DOMAIN:?Missing VITE_FIREBASE_AUTH_DOMAIN}"
: "${VITE_FIREBASE_PROJECT_ID:?Missing VITE_FIREBASE_PROJECT_ID}"
: "${VITE_FIREBASE_STORAGE_BUCKET:?Missing VITE_FIREBASE_STORAGE_BUCKET}"
: "${VITE_FIREBASE_MESSAGING_SENDER_ID:?Missing VITE_FIREBASE_MESSAGING_SENDER_ID}"
: "${VITE_FIREBASE_APP_ID:?Missing VITE_FIREBASE_APP_ID}"
: "${VITE_GOOGLE_MAPS_API_KEY:?Missing VITE_GOOGLE_MAPS_API_KEY}"
: "${SESSION_SECRET:?Missing SESSION_SECRET}"
: "${FIREBASE_PROJECT_ID:?Missing FIREBASE_PROJECT_ID}"
: "${FIREBASE_API_KEY:?Missing FIREBASE_API_KEY}"
: "${GOOGLE_CLOUD_PROJECT_ID:?Missing GOOGLE_CLOUD_PROJECT_ID}"
: "${GOOGLE_MAPS_SERVER_KEY:?Missing GOOGLE_MAPS_SERVER_KEY}"
: "${OPENCAGE_API_KEY:?Missing OPENCAGE_API_KEY}"

echo "🔨 Building Docker image..."
docker build \
  --build-arg VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
  --build-arg VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="$VITE_FIREBASE_STORAGE_BUCKET" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="$VITE_FIREBASE_MESSAGING_SENDER_ID" \
  --build-arg VITE_FIREBASE_APP_ID="$VITE_FIREBASE_APP_ID" \
  --build-arg VITE_FIREBASE_MEASUREMENT_ID="${VITE_FIREBASE_MEASUREMENT_ID:-}" \
  --build-arg VITE_GOOGLE_MAPS_API_KEY="$VITE_GOOGLE_MAPS_API_KEY" \
  -t "$IMAGE" \
  -f Dockerfile \
  .

echo "📤 Pushing image to Google Container Registry..."
docker push "$IMAGE"

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "SESSION_SECRET=$SESSION_SECRET" \
  --set-env-vars "FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID" \
  --set-env-vars "FIREBASE_API_KEY=$FIREBASE_API_KEY" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT_ID=$GOOGLE_CLOUD_PROJECT_ID" \
  --set-env-vars "GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION:-us-central1}" \
  --set-env-vars "GOOGLE_CLOUD_MODEL=${GOOGLE_CLOUD_MODEL:-gemini-2.5-flash}" \
  --set-env-vars "GOOGLE_MAPS_SERVER_KEY=$GOOGLE_MAPS_SERVER_KEY" \
  --set-env-vars "OPENCAGE_API_KEY=$OPENCAGE_API_KEY" \
  --set-env-vars "GOOGLE_APPLICATION_CREDENTIALS=./vaulted-anthem-472412-f5-df227985b096.json" \
  --project "$PROJECT_ID"

echo "✅ Done! Your app is live."
gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format "value(status.url)"
