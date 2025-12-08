import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LINE_CHANNEL_ACCESS_TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
LINE_BROADCAST_URL = "https://api.line.me/v2/bot/message/broadcast"


class ConfigError(Exception):
    """Raised when required configuration is missing."""


def _validate_configuration() -> None:
    if not LINE_CHANNEL_ACCESS_TOKEN:
        raise ConfigError("Missing required environment variable: LINE_CHANNEL_ACCESS_TOKEN")


def _extract_urls(message: str) -> List[str]:
    """Extract URL patterns from the message."""
    url_pattern = r'https?://[^\s]+'
    return re.findall(url_pattern, message)


def _extract_domain(url: str) -> str:
    """Extract domain from URL."""
    try:
        parsed = urllib.parse.urlparse(url)
        return parsed.netloc
    except Exception:
        return ""


def _validate_domain(message: str) -> None:
    """Validate domain of URLs in the message."""
    allowed_domains = {
        "asahigaoka-nerima.tokyo",
    }

    urls = _extract_urls(message)
    if not urls:
        LOGGER.warning("No URLs found in message")
        return

    found_domains = set()
    for url in urls:
        domain = _extract_domain(url)
        if domain and not any(domain.endswith(allowed) for allowed in allowed_domains):
            raise ValueError(f"URL contains unauthorized domain: {domain}")
        if domain:
            found_domains.add(domain)

    LOGGER.info("Domain validation passed: %s", found_domains)


def _broadcast_to_line(message: str) -> Dict[str, str]:
    """Send broadcast message to all LINE followers."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
    }

    payload = json.dumps({
        "messages": [
            {
                "type": "text",
                "text": message
            }
        ]
    }).encode("utf-8")

    request = urllib.request.Request(
        LINE_BROADCAST_URL,
        data=payload,
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response_body = response.read().decode("utf-8")
            return {
                "status_code": str(response.getcode()),
                "body": response_body if response_body else "{}",
            }
    except urllib.error.HTTPError as http_error:
        error_body = http_error.read().decode("utf-8")
        LOGGER.error("LINE API returned error %s: %s", http_error.code, error_body)
        raise
    except urllib.error.URLError as url_error:
        LOGGER.error("Failed to reach LINE API: %s", url_error.reason)
        raise


def _extract_message(event: Dict) -> str:
    if not event:
        raise ValueError("Empty event")
    body = event.get("body")
    if body is None:
        raise ValueError("Request body is required")
    if isinstance(body, str):
        try:
            parsed_body = json.loads(body)
        except json.JSONDecodeError as error:
            raise ValueError("Request body must be valid JSON") from error
    elif isinstance(body, dict):
        parsed_body = body
    else:
        raise ValueError("Unsupported body type")

    message = parsed_body.get("message")
    if not message:
        raise ValueError("'message' field is mandatory")
    if not isinstance(message, str):
        raise ValueError("'message' must be a string")

    # Validate domain
    _validate_domain(message)

    return message


def lambda_handler(event, context):
    LOGGER.info("Received event: %s", json.dumps(event))

    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
            "body": json.dumps({"status": "ok"}),
        }

    try:
        _validate_configuration()
        message = _extract_message(event)
        response = _broadcast_to_line(message)

        response_body = response["body"]
        try:
            parsed_response = json.loads(response_body) if response_body else {}
        except json.JSONDecodeError:
            parsed_response = {"raw": response_body}

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({
                "status": "success",
                "line_response": parsed_response,
            }),
        }
    except ConfigError as error:
        LOGGER.error("Configuration error: %s", error)
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"status": "error", "message": str(error)}),
        }
    except ValueError as error:
        LOGGER.error("Invalid input: %s", error)
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"status": "error", "message": str(error)}),
        }
    except urllib.error.HTTPError as error:
        error_body = ""
        try:
            error_body = error.read().decode("utf-8")
        except Exception:
            pass
        return {
            "statusCode": error.code,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({
                "status": "error",
                "message": f"LINE API error: {error.code}",
                "detail": error_body,
            }),
        }
    except Exception as error:
        LOGGER.exception("Unexpected error")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"status": "error", "message": "Internal server error"}),
        }
