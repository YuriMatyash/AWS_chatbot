# AWS Chatbot Scaffold (Amplify + API Gateway + Lambda + DynamoDB)

This repository contains a minimal chatbot scaffold for AWS.

## Selected backend

**Primary backend**: `backend/lambda_chat/lambda_function.py` (Python 3.12).

There is also a Node.js Lambda under `backend/lambda/` from an earlier scaffold iteration. Treat that Node.js path as **optional/legacy** unless you intentionally choose to run it.

## Required AWS resources

1. **DynamoDB table**: `ChatMessages`
   - Partition key: `chatId` (String)
   - Sort key: `createdAtMessageId` (String)
2. **Secrets Manager secret**: `openai/chatbot/api-key`
   - Store your OpenAI API key here (plain string or JSON with `OPENAI_API_KEY`)
3. **Lambda function** (Python 3.12) using `backend/lambda_chat/lambda_function.py`
4. **API Gateway** (HTTP API or REST API)
   - Route `POST /chat` to Lambda proxy integration
   - Route `OPTIONS /chat` to Lambda or configure equivalent CORS
5. **Amplify Hosting** for `frontend/`

## Required environment variables

Set these on Lambda:

- `TABLE_NAME=ChatMessages`
- `OPENAI_SECRET_NAME=openai/chatbot/api-key`
- `OPENAI_MODEL=gpt-4.1-nano`
- `ALLOWED_ORIGIN=*`

Set this for frontend build/runtime:

- `VITE_API_BASE_URL=https://YOUR_API_ID.execute-api.REGION.amazonaws.com`

## Frontend behavior

Frontend code (`frontend/src/api.js` and `frontend/src/main.js`) sends:

```json
{
  "chatId": "...",
  "message": "..."
}
```

to:

`POST ${VITE_API_BASE_URL}/chat`

The browser stores and reuses `chatId` in `sessionStorage` for the current tab/session.

## Lambda direct test

You can test directly in Lambda console with this event:

```json
{
  "httpMethod": "POST",
  "body": "{\"chatId\":\"test-chat-1\",\"message\":\"Hello, reply with one short sentence.\"}"
}
```

Expected response format:

```json
{
  "chatId": "...",
  "reply": "..."
}
```

## Packaging / dependencies

Dependencies may be supplied by a **Lambda Layer** (your current approach), or bundled as a zip package.

See `backend/lambda_chat/README.md` for Python 3.12 packaging steps and IAM permission notes.

## Request flow

1. User sends message in Amplify frontend.
2. Frontend POSTs `{ chatId, message }` to API Gateway `/chat`.
3. API Gateway invokes Lambda.
4. Lambda loads latest chat history from DynamoDB, keeps chronological order, and appends current user message.
5. Lambda calls OpenAI Responses API.
6. Lambda stores user and assistant messages to DynamoDB.
7. Lambda returns `{ chatId, reply }`.

## Security notes

- Do **not** put OpenAI API keys in frontend files.
- Do **not** hardcode secrets in Lambda code.
- OpenAI key is loaded from Secrets Manager at runtime.

## Not deployed

This repo does **not** deploy resources automatically.
