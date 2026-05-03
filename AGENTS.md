# AGENTS.md

## Project mission

Build a beginner-friendly serverless chatbot web app.

The app uses:

- AWS Amplify for frontend hosting.
- Amazon API Gateway as the public HTTP API.
- AWS Lambda for backend logic.
- Amazon DynamoDB for saving chat sessions and messages.
- The OpenAI API for generating chatbot responses.

The frontend must never call OpenAI directly. All OpenAI API calls must happen inside Lambda.

---

## Current MVP goal

Start with the smallest working flow, then improve it step by step.

1. Create a local Python console chatbot using the OpenAI Python SDK.
2. Move the same chatbot logic into an AWS Lambda handler.
3. Add API Gateway so the frontend can call the Lambda function.
4. Save and load chat history from DynamoDB.
5. Connect the Amplify frontend to the API.

Do not jump straight into a complicated production architecture unless explicitly asked.

---

## Preferred language and style

Use Python for Lambda unless the existing repo is already clearly using another backend language.

Write code for a beginner:

- Keep functions small.
- Add clear comments where the logic is not obvious.
- Use meaningful variable names.
- Prefer simple, readable code over clever abstractions.
- Avoid adding unnecessary dependencies.
- When adding dependencies, update `requirements.txt`.
- Do not rewrite unrelated files.

---

## OpenAI API requirements

Use the official OpenAI Python SDK.

Starter pattern:

```python
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

response = client.responses.create(
    model=os.environ.get("OPENAI_MODEL", "gpt-4.1-nano"),
    input=conversation_history,
)

assistant_text = response.output_text
```

Use the Responses API, not legacy completions.

For the MVP, default to:

```text
gpt-4.1-nano
```

Keep the model name configurable with an environment variable called `OPENAI_MODEL` so it can be changed later without editing code.

Conversation history should be represented as a list of message dictionaries:

```python
conversation_history = [
    {"role": "developer", "content": "You are a helpful chatbot."},
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! How can I help?"},
]
```

When building history for the OpenAI call:

- Always include one developer message at the beginning.
- Include the most recent messages from DynamoDB.
- Append the new user message before calling OpenAI.
- Do not send unlimited history forever; for now, send only the latest 20 messages plus the developer message.

---

## Local console chatbot milestone

When asked to create the first local version, create something like:

```text
backend/local_chat.py
```

It should:

1. Import `OpenAI` from `openai`.
2. Initialize the OpenAI client from `OPENAI_API_KEY`.
3. Create an empty conversation history list.
4. Use a `while True` loop to ask the user for input.
5. Stop when the user types `exit`.
6. Append each user message to the conversation history.
7. Call `client.responses.create(...)`.
8. Print the assistant response.
9. Append the assistant response to the conversation history.

Keep this file independent from AWS so it is easy to test locally.

---

## Lambda API contract

Create a Lambda handler for a route like:

```http
POST /chat
```

Expected request body:

```json
{
  "userId": "dev-user",
  "chatId": "optional-existing-chat-id",
  "message": "User message here"
}
```

Expected response body:

```json
{
  "chatId": "generated-or-existing-chat-id",
  "answer": "Assistant response here",
  "model": "gpt-4.1-nano",
  "createdAt": "2026-05-03T00:00:00Z"
}
```

If `chatId` is missing, create a new UUID.

Validate input:

- `message` is required.
- `message` must be a non-empty string.
- `userId` is required for now, but use `dev-user` only in local/dev examples.

Return clear JSON errors for invalid input.

---

## API Gateway and CORS

All Lambda responses called from API Gateway must include CORS headers.

Use a helper such as:

```python
def build_response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
        },
        "body": json.dumps(body),
    }
```

For production, replace `*` with the real Amplify domain.

---

## DynamoDB data model

Prefer a simple two-table MVP.

### Table: `ChatSessions`

Primary key:

- Partition key: `user_id`
- Sort key: `chat_id`

Attributes:

- `title`
- `created_at`
- `updated_at`
- `last_message_preview`

Purpose:

- List all chats for a user.
- Create new chat sessions.
- Update the latest activity time.

### Table: `ChatMessages`

Primary key:

- Partition key: `chat_id`
- Sort key: `created_at`

Attributes:

- `message_id`
- `user_id`
- `role` — one of `user`, `assistant`, `developer`
- `content`
- `model` — only for assistant messages
- `openai_response_id` — only if available

Purpose:

- Load messages for one chat in chronological order.
- Save each user and assistant message separately.

When calling OpenAI:

1. Query `ChatMessages` by `chat_id`.
2. Take the latest 20 messages.
3. Convert them into OpenAI message format.
4. Append the new user message.
5. Call OpenAI.
6. Save the user message.
7. Save the assistant message.
8. Update `ChatSessions.updated_at`.

---

## Environment variables

Use these variables:

```text
OPENAI_API_KEY
OPENAI_MODEL=gpt-4.1-nano
CHAT_SESSIONS_TABLE=ChatSessions
CHAT_MESSAGES_TABLE=ChatMessages
ALLOWED_ORIGIN=*
```

Rules:

- Never hardcode `OPENAI_API_KEY`.
- Never expose `OPENAI_API_KEY` to the frontend.
- Never commit `.env` files.
- For production, prefer AWS Secrets Manager or Parameter Store for secrets.

---

## Suggested backend folder structure

Use this structure unless the repo already has a clear structure:

```text
backend/
  local_chat.py
  requirements.txt
  lambda/
    chat_handler.py
    openai_service.py
    dynamodb_service.py
    response_utils.py
```

Suggested responsibilities:

- `chat_handler.py`: Lambda entry point, request validation, response formatting.
- `openai_service.py`: OpenAI client setup and response generation.
- `dynamodb_service.py`: Save/load chat sessions and messages.
- `response_utils.py`: CORS and JSON response helpers.
- `local_chat.py`: local console-only chatbot for initial testing.

---

## Frontend expectations

The frontend should call the backend API only.

Do not put OpenAI logic in the frontend.

Minimal frontend behavior:

1. User types a message.
2. Frontend sends `POST /chat` with `userId`, `chatId`, and `message`.
3. Frontend shows the assistant response.
4. Frontend stores the returned `chatId` for follow-up messages.

---

## Error handling rules

Handle these cases cleanly:

- Missing request body.
- Invalid JSON.
- Missing `message`.
- Empty `message`.
- Missing OpenAI API key.
- OpenAI API failure.
- DynamoDB read/write failure.

Do not leak stack traces or secrets to API responses.

Log useful debugging information to CloudWatch, but never log the OpenAI API key.

---

## Cost-control rules

This is a student project/MVP, so keep costs low.

- Use a low-cost model by default.
- Limit the number of history messages sent to OpenAI.
- Avoid unnecessary API calls.
- Do not stream responses in the first version unless asked.
- Do not create expensive AWS resources unless explicitly requested.
- Prefer DynamoDB on-demand mode for MVP simplicity unless the repo already uses another mode.

---

## Security rules

Follow these rules strictly:

- OpenAI API key must stay server-side.
- Validate all incoming JSON.
- Do not trust client-provided values blindly.
- Use least-privilege IAM permissions for Lambda.
- Lambda should only access the DynamoDB tables it needs.
- Do not store passwords or private keys in Git.
- Do not add real secrets to test files.

---

## Testing expectations

When implementing backend code, add lightweight tests when practical.

At minimum, manually verify:

1. Local console chatbot works.
2. Lambda handler returns 400 for bad input.
3. Lambda handler returns 200 for valid input.
4. User and assistant messages are saved to DynamoDB.
5. Follow-up messages include previous chat history.
6. Frontend can call API Gateway without CORS errors.

If tests are added, prefer simple `pytest` tests for pure functions such as request validation and message formatting.

---

## What not to do

Do not:

- Build a full authentication system unless asked.
- Add Cognito unless asked.
- Add streaming unless asked.
- Add vector databases or RAG unless asked.
- Add LangChain unless asked.
- Call OpenAI from the frontend.
- Store the OpenAI API key in Amplify frontend environment variables.
- Create overly complex infrastructure before the basic chatbot works.

---

## Definition of done for the first milestone

The first milestone is done when:

- `backend/local_chat.py` runs locally.
- It uses `from openai import OpenAI`.
- It uses `client.responses.create(...)`.
- It keeps an in-memory conversation history.
- It exits when the user types `exit`.
- The model is configurable and defaults to `gpt-4.1-nano`.
- No API keys are hardcoded.
