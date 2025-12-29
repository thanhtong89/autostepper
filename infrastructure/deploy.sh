#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}AutoStepper AWS Infrastructure Deployment${NC}"
echo "==========================================="

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="${PROJECT_NAME:-autostepper}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

# Derived names
ECR_REPO_NAME="${PROJECT_NAME}-${ENVIRONMENT}-youtube-dl"
LAMBDA_FUNCTION_NAME="${PROJECT_NAME}-${ENVIRONMENT}-youtube-dl"

echo -e "\n${YELLOW}Configuration:${NC}"
echo "  AWS Region: $AWS_REGION"
echo "  Project: $PROJECT_NAME"
echo "  Environment: $ENVIRONMENT"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO_URL="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo -e "\n${YELLOW}Step 1: Deploy Terraform infrastructure${NC}"
cd "$(dirname "$0")/terraform"

terraform init -upgrade
terraform apply -auto-approve \
    -var="aws_region=${AWS_REGION}" \
    -var="project_name=${PROJECT_NAME}" \
    -var="environment=${ENVIRONMENT}"

# Get outputs
LAMBDA_URL=$(terraform output -raw lambda_function_url 2>/dev/null || echo "")
S3_BUCKET=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")

echo -e "\n${YELLOW}Step 2: Build and push Docker image${NC}"
cd ../lambda

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URL

# Build for ARM64 (Lambda Graviton2)
echo "Building Docker image for ARM64..."
docker build --platform linux/arm64 -t $ECR_REPO_NAME:latest .

# Tag and push
docker tag $ECR_REPO_NAME:latest $ECR_REPO_URL:latest
echo "Pushing image to ECR..."
docker push $ECR_REPO_URL:latest

echo -e "\n${YELLOW}Step 3: Update Lambda function${NC}"
aws lambda update-function-code \
    --function-name $LAMBDA_FUNCTION_NAME \
    --image-uri $ECR_REPO_URL:latest \
    --region $AWS_REGION

# Wait for update to complete
echo "Waiting for Lambda update..."
aws lambda wait function-updated \
    --function-name $LAMBDA_FUNCTION_NAME \
    --region $AWS_REGION

echo -e "\n${GREEN}Deployment complete!${NC}"
echo "==========================================="
echo -e "Lambda Function URL: ${GREEN}${LAMBDA_URL}${NC}"
echo -e "S3 Bucket: ${GREEN}${S3_BUCKET}${NC}"
echo ""
echo "Add this to your frontend .env file:"
echo "  VITE_LAMBDA_URL=${LAMBDA_URL}"
