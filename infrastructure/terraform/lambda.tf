# ECR repository for Lambda container image
resource "aws_ecr_repository" "lambda" {
  name                 = "${local.name_prefix}-youtube-dl"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = false
  }
}

# IAM role for Lambda
resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for Lambda to access S3 and CloudWatch
resource "aws_iam_role_policy" "lambda" {
  name = "${local.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.audio_temp.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Lambda function (container image)
resource "aws_lambda_function" "youtube_dl" {
  function_name = "${local.name_prefix}-youtube-dl"
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.lambda.repository_url}:latest"
  architectures = ["arm64"]

  memory_size = var.lambda_memory_mb
  timeout     = var.lambda_timeout_seconds

  environment {
    variables = {
      S3_BUCKET = aws_s3_bucket.audio_temp.id
    }
  }

  # Ignore image_uri changes until we have an actual image
  lifecycle {
    ignore_changes = [image_uri]
  }
}

# Lambda function URL (public endpoint without API Gateway)
resource "aws_lambda_function_url" "youtube_dl" {
  function_name      = aws_lambda_function.youtube_dl.function_name
  authorization_type = "NONE"

  cors {
    allow_origins     = ["*"]  # In production, restrict to your domain
    allow_methods     = ["POST", "OPTIONS"]
    allow_headers     = ["Content-Type"]
    max_age           = 3600
  }
}

# CloudWatch log group
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.youtube_dl.function_name}"
  retention_in_days = 7
}

# Outputs
output "lambda_function_url" {
  description = "Lambda function URL (use this in your frontend)"
  value       = aws_lambda_function_url.youtube_dl.function_url
}

output "ecr_repository_url" {
  description = "ECR repository URL for pushing Docker images"
  value       = aws_ecr_repository.lambda.repository_url
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.youtube_dl.function_name
}
