# S3 bucket for temporary audio storage
resource "aws_s3_bucket" "audio_temp" {
  bucket = "${local.name_prefix}-audio-temp"

  # Allow bucket to be destroyed even with objects (for dev)
  force_destroy = true
}

# Block public access
resource "aws_s3_bucket_public_access_block" "audio_temp" {
  bucket = aws_s3_bucket.audio_temp.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rule to auto-delete after 1 day
resource "aws_s3_bucket_lifecycle_configuration" "audio_temp" {
  bucket = aws_s3_bucket.audio_temp.id

  rule {
    id     = "expire-temp-audio"
    status = "Enabled"

    filter {
      prefix = "audio/"
    }

    expiration {
      days = var.s3_expiration_days
    }
  }
}

# CORS configuration for browser access
resource "aws_s3_bucket_cors_configuration" "audio_temp" {
  bucket = aws_s3_bucket.audio_temp.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]  # In production, restrict to your domain
    expose_headers  = ["Content-Length", "Content-Type"]
    max_age_seconds = 3600
  }
}

# Output the bucket name
output "s3_bucket_name" {
  description = "Name of the S3 bucket for audio files"
  value       = aws_s3_bucket.audio_temp.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.audio_temp.arn
}
