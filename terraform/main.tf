terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# 変数定義
variable "dify_api_key" {
  description = "Dify API Key for article generation"
  type        = string
  sensitive   = true
}

variable "dify_api_endpoint" {
  description = "Dify API endpoint URL"
  type        = string
  default     = "https://top-overly-pup.ngrok-free.app/v1/workflows/run"
}

provider "aws" {
  region = "ap-northeast-1"
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

locals {
  domain_name = "asahigaoka-nerima.tokyo"
  bucket_name = "asahigaoka-nerima-tokyo"
}

data "aws_route53_zone" "main" {
  name = local.domain_name
}

resource "aws_s3_bucket" "website" {
  bucket = local.bucket_name
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${local.bucket_name}-oac"
  description                       = "OAC for ${local.domain_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "website" {
  provider          = aws.us_east_1
  domain_name       = local.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  for_each = {
    for dvo in aws_acm_certificate.website.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "website" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.website.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [local.domain_name]
  price_class         = "PriceClass_200"

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "S3-${local.bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${local.bucket_name}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true

  }

  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 404
    response_page_path = "/404.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.website.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  depends_on = [aws_acm_certificate_validation.website]
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.website.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.website.arn
          }
        }
      }
    ]
  })
}

resource "aws_route53_record" "website" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.website.domain_name
    zone_id                = aws_cloudfront_distribution.website.hosted_zone_id
    evaluate_target_health = false
  }
}

output "s3_bucket_name" {
  value = aws_s3_bucket.website.id
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.website.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.website.domain_name
}

output "website_url" {
  value = "https://${local.domain_name}"
}

# ===================================
# Dify API Proxy Lambda Function
# ===================================

# Lambda用IAMロール
resource "aws_iam_role" "dify_proxy_lambda" {
  name = "dify-proxy-lambda-role"

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

# CloudWatch Logs用のポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "dify_proxy_lambda_logs" {
  role       = aws_iam_role.dify_proxy_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda関数用のZIPファイルを作成
data "archive_file" "dify_proxy_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/dify_proxy"
  output_path = "${path.module}/lambda/dify_proxy.zip"
}

# Lambda関数
resource "aws_lambda_function" "dify_proxy" {
  filename         = data.archive_file.dify_proxy_lambda.output_path
  function_name    = "dify-api-proxy"
  role            = aws_iam_role.dify_proxy_lambda.arn
  handler         = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.dify_proxy_lambda.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      DIFY_API_KEY      = var.dify_api_key
      DIFY_API_ENDPOINT = var.dify_api_endpoint
    }
  }
}

# CloudWatch Logsグループ
resource "aws_cloudwatch_log_group" "dify_proxy_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.dify_proxy.function_name}"
  retention_in_days = 7
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "dify_proxy" {
  name        = "dify-proxy-api"
  description = "Dify API Proxy for article generation"
}

# API Gateway リソース（/generate-article）
resource "aws_api_gateway_resource" "generate_article" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  parent_id   = aws_api_gateway_rest_api.dify_proxy.root_resource_id
  path_part   = "generate-article"
}

# API Gateway メソッド（POST）
resource "aws_api_gateway_method" "generate_article_post" {
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  resource_id   = aws_api_gateway_resource.generate_article.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway メソッド（OPTIONS - CORS用）
resource "aws_api_gateway_method" "generate_article_options" {
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  resource_id   = aws_api_gateway_resource.generate_article.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway 統合（POST）
resource "aws_api_gateway_integration" "generate_article_post" {
  rest_api_id             = aws_api_gateway_rest_api.dify_proxy.id
  resource_id             = aws_api_gateway_resource.generate_article.id
  http_method             = aws_api_gateway_method.generate_article_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.dify_proxy.invoke_arn
}

# API Gateway 統合（OPTIONS - CORS用）
resource "aws_api_gateway_integration" "generate_article_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.generate_article.id
  http_method = aws_api_gateway_method.generate_article_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# API Gateway メソッドレスポンス（OPTIONS）
resource "aws_api_gateway_method_response" "generate_article_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.generate_article.id
  http_method = aws_api_gateway_method.generate_article_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

# API Gateway 統合レスポンス（OPTIONS）
resource "aws_api_gateway_integration_response" "generate_article_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.generate_article.id
  http_method = aws_api_gateway_method.generate_article_options.http_method
  status_code = aws_api_gateway_method_response.generate_article_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.generate_article_options]
}

# Lambda実行許可（API Gatewayから）
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.dify_proxy.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.dify_proxy.execution_arn}/*/*"
}

# API Gateway デプロイ
resource "aws_api_gateway_deployment" "dify_proxy" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.generate_article.id,
      aws_api_gateway_method.generate_article_post.id,
      aws_api_gateway_method.generate_article_options.id,
      aws_api_gateway_integration.generate_article_post.id,
      aws_api_gateway_integration.generate_article_options.id,
      aws_api_gateway_integration_response.generate_article_options.id,
      timestamp()
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.generate_article_post,
    aws_api_gateway_integration.generate_article_options
  ]
}

# API Gateway ステージ
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.dify_proxy.id
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  stage_name    = "prod"
}

# 出力：API Gateway エンドポイント
output "dify_proxy_api_endpoint" {
  value       = "${aws_api_gateway_stage.prod.invoke_url}/generate-article"
  description = "Dify Proxy API endpoint URL"
}
