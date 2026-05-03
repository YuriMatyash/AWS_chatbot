# Lambda Chat Backend (Python 3.12)

This folder contains an AWS Lambda handler for chatbot requests via API Gateway proxy integration.

## Files

- `lambda_function.py` - Lambda entrypoint (`lambda_handler`).
- `requirements.txt` - Python dependencies.

## Runtime and environment

- Runtime: **Python 3.12**
- Expected environment variables:
  - `TABLE_NAME=ChatMessages`
  - `OPENAI_SECRET_NAME=openai/chatbot/api-key`
  - `OPENAI_MODEL=gpt-4.1-nano`
  - `ALLOWED_ORIGIN=*`

## API contract

Lambda expects API Gateway proxy event with method `POST` and JSON body:

```json
{
  "chatId": "some-chat-id",
  "message": "user message"
}
```

- If `chatId` is missing/empty, Lambda generates a new UUID.
- Response:

```json
{
  "chatId": "...",
  "reply": "..."
}
```

## DynamoDB schema

Table name should match `TABLE_NAME` (default `ChatMessages`) with:

- Partition key: `chatId` (String)
- Sort key: `createdAtMessageId` (String)

Each saved item includes:
- `chatId`
- `createdAtMessageId`
- `role`
- `content`
- `createdAt`

## Secrets Manager secret format

`OPENAI_SECRET_NAME` should point to a secret that contains either:
- Plain string secret with the OpenAI API key, OR
- JSON string with key `OPENAI_API_KEY` or `apiKey`.

## Packaging (zip)

From `backend/lambda_chat`:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdir -p package
pip install -r requirements.txt -t package
cp lambda_function.py package/
cd package && zip -r ../lambda_chat.zip .
```

Upload `lambda_chat.zip` to a Lambda function configured for Python 3.12.

## IAM permissions required for Lambda role

- `dynamodb:Query`
- `dynamodb:PutItem`
- `secretsmanager:GetSecretValue`

Scope these permissions to the specific table and secret where possible.

## API Gateway notes

- Use Lambda proxy integration.
- Route `POST /chat` to this Lambda.
- Ensure `OPTIONS /chat` reaches Lambda or configure equivalent CORS in API Gateway.
- Lambda already returns CORS headers on success and error responses.

## Not deployed

No resources are deployed automatically from this repository.
