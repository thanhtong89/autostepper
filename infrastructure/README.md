# AutoStepper AWS Infrastructure

This directory contains the AWS infrastructure for the AutoStepper web application.

## Architecture

```
Browser → Lambda Function URL → Lambda (yt-dlp) → S3 (temp storage)
                                                        ↓
                                              Pre-signed URL (1hr)
                                                        ↓
                                              Browser downloads MP3
```

## Components

### Lambda Function
- **Runtime**: Container image (Python 3.11 + ffmpeg + yt-dlp + Deno)
- **Architecture**: ARM64 (Graviton2) - 20% cheaper than x86
- **Memory**: 1024MB
- **Timeout**: 120 seconds
- **Endpoint**: Lambda Function URL (no API Gateway needed)
- **Note**: Deno is required by yt-dlp to handle YouTube's JavaScript challenges

### S3 Bucket
- **Purpose**: Temporary storage for downloaded audio files
- **Lifecycle**: Objects auto-delete after 1 day
- **Access**: Pre-signed URLs only (no public access)
- **CORS**: Enabled for browser downloads

## Prerequisites

1. **AWS CLI** - Configured with credentials
   ```bash
   aws configure
   ```

2. **Docker** - For building Lambda container images
   ```bash
   docker --version
   ```

3. **Terraform** - For infrastructure provisioning
   ```bash
   terraform --version
   ```

## Deployment

### Quick Deploy

```bash
./deploy.sh
```

### Manual Steps

1. **Initialize Terraform**
   ```bash
   cd terraform
   terraform init
   ```

2. **Review plan**
   ```bash
   terraform plan
   ```

3. **Apply infrastructure**
   ```bash
   terraform apply
   ```

4. **Build and push Docker image**
   ```bash
   cd ../lambda

   # Get ECR repository URL from Terraform output
   ECR_URL=$(cd ../terraform && terraform output -raw ecr_repository_url)

   # Login to ECR
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URL

   # Build for ARM64
   docker build --platform linux/arm64 -t autostepper-youtube-dl .

   # Tag and push
   docker tag autostepper-youtube-dl:latest $ECR_URL:latest
   docker push $ECR_URL:latest
   ```

5. **Update Lambda**
   ```bash
   aws lambda update-function-code \
     --function-name autostepper-dev-youtube-dl \
     --image-uri $ECR_URL:latest
   ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-east-1` | AWS region for resources |
| `PROJECT_NAME` | `autostepper` | Project name prefix |
| `ENVIRONMENT` | `dev` | Environment (dev/staging/prod) |

### Terraform Variables

See `terraform/variables.tf` for all configurable options.

## Cost Estimate

| Usage | Monthly Cost |
|-------|--------------|
| 0-8,800 songs | ~$0 (free tier) |
| 100 songs | ~$0.15 |
| 500 songs | ~$0.75 |
| 1,000 songs | ~$1.50 |

### Cost Breakdown per Song (~$0.0015)
- Lambda compute: 45 GB-seconds @ $0.0000167 = $0.00075
- S3 storage (1 day): negligible
- S3 requests: ~$0.00001
- Data transfer: 8MB @ $0.09/GB = $0.00072

## Testing

### Test the Lambda function

```bash
# Get the function URL
LAMBDA_URL=$(cd terraform && terraform output -raw lambda_function_url)

# Test with a YouTube URL
curl -X POST $LAMBDA_URL \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### Expected Response

```json
{
  "id": "uuid-here",
  "title": "Video Title",
  "artist": "Channel Name",
  "duration": 180,
  "thumbnail": "https://...",
  "downloadUrl": "https://s3.amazonaws.com/...",
  "fileSize": 5242880
}
```

## Cleanup

To destroy all resources:

```bash
cd terraform
terraform destroy
```

## Troubleshooting

### Lambda timeout
- Increase `lambda_timeout_seconds` in `variables.tf`
- Default is 120 seconds, max is 900

### Large files failing
- yt-dlp has `--max-filesize 50m` limit
- Increase in `lambda/handler.py` if needed

### Docker build fails on M1/M2 Mac
- Ensure you're building for `linux/arm64`:
  ```bash
  docker build --platform linux/arm64 -t autostepper-youtube-dl .
  ```

### Lambda cold starts
- First request may take 5-10 seconds
- Subsequent requests are faster (~1-2 seconds)

### YouTube bot detection
- Deno is included in the Lambda container to handle YouTube's JavaScript challenges
- If you still see bot detection errors, YouTube may be rate-limiting the Lambda's IP
- Consider implementing request delays between downloads
