import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from openai import OpenAI

TABLE_NAME = os.environ.get("TABLE_NAME", "ChatMessages")
OPENAI_SECRET_NAME = os.environ.get("OPENAI_SECRET_NAME", "openai/chatbot/api-key")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4.1-nano")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")


dynamodb = boto3.resource("dynamodb")
secrets_client = boto3.client("secretsmanager")
_table = dynamodb.Table(TABLE_NAME)
_openai_client = None


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
        "Content-Type": "application/json",
    }


def _response(status_code, payload):
    return {
        "statusCode": status_code,
        "headers": _cors_headers(),
        "body": json.dumps(payload),
    }


def _load_openai_key_from_secret():
    secret_value = secrets_client.get_secret_value(SecretId=OPENAI_SECRET_NAME)
    if "SecretString" in secret_value:
        raw = secret_value["SecretString"]
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed.get("OPENAI_API_KEY") or parsed.get("apiKey") or raw
        except json.JSONDecodeError:
            return raw
    raise RuntimeError("OpenAI API key secret is missing SecretString")


def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        api_key = _load_openai_key_from_secret()
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _message_sort_key(now_iso):
    return f"{now_iso}#{uuid.uuid4()}"


def _load_chat_history(chat_id, limit=50):
    result = _table.query(
        KeyConditionExpression=Key("chatId").eq(chat_id),
        ScanIndexForward=True,
        Limit=limit,
    )
    items = result.get("Items", [])
    return [{"role": item["role"], "content": item["content"]} for item in items]


def _save_message(chat_id, role, content):
    now_iso = _now_iso()
    item = {
        "chatId": chat_id,
        "createdAtMessageId": _message_sort_key(now_iso),
        "role": role,
        "content": content,
        "createdAt": now_iso,
    }
    _table.put_item(Item=item)


def _extract_reply_text(response):
    if getattr(response, "output_text", None):
        return response.output_text
    return "Sorry, I could not generate a reply."


def lambda_handler(event, context):
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")

    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": _cors_headers(),
            "body": "",
        }

    if method != "POST":
        return _response(405, {"error": "Method not allowed. Use POST."})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body."})

    message = (body.get("message") or "").strip()
    chat_id = (body.get("chatId") or "").strip() or str(uuid.uuid4())

    if not message:
        return _response(400, {"error": "message is required."})

    try:
        history = _load_chat_history(chat_id)
        _save_message(chat_id, "user", message)

        client = _get_openai_client()
        response = client.responses.create(
            model=OPENAI_MODEL,
            input=[*history, {"role": "user", "content": message}],
        )
        reply = _extract_reply_text(response)

        _save_message(chat_id, "assistant", reply)

        return _response(200, {"chatId": chat_id, "reply": reply})
    except Exception as exc:
        print(f"Error handling chat request: {exc}")
        return _response(500, {"error": "Internal server error."})
