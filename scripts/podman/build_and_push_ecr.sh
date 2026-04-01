#!/usr/bin/env bash
set -euo pipefail

# Usage:
# AWS_ACCOUNT_ID=123456789012 AWS_REGION=ap-south-1 TAG=v1 ./scripts/podman/build_and_push_ecr.sh

AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required}"
AWS_REGION="${AWS_REGION:-ap-south-1}"
TAG="${TAG:-latest}"

BACKEND_REPO="${BACKEND_REPO:-pos-backend}"
FRONTEND_REPO="${FRONTEND_REPO:-pos-frontend}"

REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
BACKEND_IMAGE="${REGISTRY}/${BACKEND_REPO}:${TAG}"
FRONTEND_IMAGE="${REGISTRY}/${FRONTEND_REPO}:${TAG}"

echo "[ecr] Ensuring repositories exist..."
aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$BACKEND_REPO" >/dev/null 2>&1 \
  || aws ecr create-repository --region "$AWS_REGION" --repository-name "$BACKEND_REPO" >/dev/null
aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$FRONTEND_REPO" >/dev/null 2>&1 \
  || aws ecr create-repository --region "$AWS_REGION" --repository-name "$FRONTEND_REPO" >/dev/null

echo "[ecr] Logging in Podman to ECR..."
aws ecr get-login-password --region "$AWS_REGION" \
  | podman login --username AWS --password-stdin "$REGISTRY"

echo "[build] Building backend image: $BACKEND_IMAGE"
podman build -t "$BACKEND_IMAGE" -f pos_be/pos_backend/Dockerfile pos_be/pos_backend

echo "[build] Building frontend image: $FRONTEND_IMAGE"
podman build -t "$FRONTEND_IMAGE" -f pos_fe/Dockerfile pos_fe

echo "[push] Pushing backend image..."
podman push "$BACKEND_IMAGE"

echo "[push] Pushing frontend image..."
podman push "$FRONTEND_IMAGE"

echo
echo "Use these values in your AWS .env:"
echo "BACKEND_IMAGE=$BACKEND_IMAGE"
echo "FRONTEND_IMAGE=$FRONTEND_IMAGE"
