import json
import logging
import os
import random
import re
import string
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

CONSUMER_KEY = os.environ.get("TWITTER_API_KEY")
CONSUMER_SECRET = os.environ.get("TWITTER_API_SECRET")
ACCESS_TOKEN = os.environ.get("TWITTER_ACCESS_TOKEN")
ACCESS_TOKEN_SECRET = os.environ.get("TWITTER_ACCESS_TOKEN_SECRET")
API_URL = "https://api.twitter.com/2/tweets"


class ConfigError(Exception):
    """Raised when required configuration is missing."""


def _percent_encode(value: str) -> str:
    return urllib.parse.quote(value, safe="~-._")


def _generate_nonce(length: int = 32) -> str:
    charset = string.ascii_letters + string.digits
    return "".join(random.choice(charset) for _ in range(length))


def _generate_timestamp() -> str:
    return str(int(time.time()))


def _build_signature_base_string(method: str, url: str, params: Dict[str, str]) -> str:
    encoded_url = _percent_encode(url)
    sorted_items = sorted((key, value) for key, value in params.items())
    param_string = _percent_encode("&".join(f"{_percent_encode(k)}={_percent_encode(v)}" for k, v in sorted_items))
    return "&".join([method.upper(), encoded_url, param_string])


def _generate_signature(method: str, url: str, params: Dict[str, str]) -> str:
    import hashlib
    import hmac
    import base64

    base_string = _build_signature_base_string(method, url, params)
    signing_key = "&".join((_percent_encode(CONSUMER_SECRET), _percent_encode(ACCESS_TOKEN_SECRET)))
    digest = hmac.new(signing_key.encode("utf-8"), base_string.encode("utf-8"), hashlib.sha1).digest()
    return base64.b64encode(digest).decode("utf-8")


def _build_oauth_headers() -> str:
    oauth_params = {
        "oauth_consumer_key": CONSUMER_KEY,
        "oauth_nonce": _generate_nonce(),
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": _generate_timestamp(),
        "oauth_token": ACCESS_TOKEN,
        "oauth_version": "1.0",
    }
    signature = _generate_signature("POST", API_URL, oauth_params)
    oauth_params["oauth_signature"] = signature
    header_params = ", ".join(f'{_percent_encode(k)}="{_percent_encode(v)}"' for k, v in oauth_params.items())
    return f"OAuth {header_params}"


def _post_to_x(message: str) -> Dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Authorization": _build_oauth_headers(),
        "User-Agent": "asahigaoka-x-post/1.0",
    }

    payload = json.dumps({"text": message}).encode("utf-8")
    request = urllib.request.Request(API_URL, data=payload, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response_body = response.read().decode("utf-8")
            return {
                "status_code": str(response.getcode()),
                "body": response_body,
            }
    except urllib.error.HTTPError as http_error:
        error_body = http_error.read().decode("utf-8")
        LOGGER.error("X API returned error %s: %s", http_error.code, error_body)
        raise
    except urllib.error.URLError as url_error:
        LOGGER.error("Failed to reach X API: %s", url_error.reason)
        raise


def _validate_configuration() -> None:
    missing = [
        key
        for key, value in [
            ("TWITTER_API_KEY", CONSUMER_KEY),
            ("TWITTER_API_SECRET", CONSUMER_SECRET),
            ("TWITTER_ACCESS_TOKEN", ACCESS_TOKEN),
            ("TWITTER_ACCESS_TOKEN_SECRET", ACCESS_TOKEN_SECRET),
        ]
        if not value
    ]
    if missing:
        raise ConfigError(f"Missing required environment variables: {', '.join(missing)}")


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
        # No URL found - just log a warning
        LOGGER.warning("No URLs found in message")
        return

    found_domains = set()
    for url in urls:
        domain = _extract_domain(url)
        if domain and not any(domain.endswith(allowed) for allowed in allowed_domains):
            raise ValueError(f"URL contains unauthorized domain: {domain}")
        if domain:
            found_domains.add(domain)

    if len(found_domains) > 1:
        LOGGER.warning("Message contains multiple domains: %s", found_domains)

    LOGGER.info("Domain validation passed: %s", found_domains)


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
        response = _post_to_x(message)
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({
                "status": "success",
                "tweet_response": json.loads(response["body"]),
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
        return {
            "statusCode": error.code,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({
                "status": "error",
                "message": f"X API error: {error.code}",
            }),
        }
    except Exception as error:  # pylint: disable=broad-except
        LOGGER.exception("Unexpected error")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"status": "error", "message": "Internal server error"}),
        }
