# AWS Chatbot (Initial Scaffold)

This repository now contains a minimal working chatbot scaffold:
- Frontend chat UI (for AWS Amplify hosting)
- Backend Lambda handler (for API Gateway invocation)
- OpenAI Responses API integration
- DynamoDB chat history load/save

## Current project structure

- `frontend/`
  - `index.html`
  - `src/main.js`
  - `src/api.js`
  - `src/styles.css`
- `backend/lambda/`
  - `index.js`
  - `package.json`
- `.env.example`

## Run locally

### 1) Frontend
Use any static file server from `frontend/`.

Example:
```bash
cd frontend
python3 -m http.server 4173
```
Then open `http://localhost:4173`.

TODO: For local browser testing, expose `VITE_API_BASE_URL` via your frontend build/runtime process.

### 2) Lambda handler local test
From `backend/lambda`:
```bash
npm install
```

You can invoke `handler` with a local event payload using your preferred Lambda local tooling.

## AWS resources needed

1. **AWS Amplify Hosting** for `frontend/`.
2. **API Gateway HTTP API** with:
   - `POST /chat` route integrated to Lambda
   - `OPTIONS /chat` route (or automatic CORS in API Gateway)
3. **AWS Lambda** for `backend/lambda/index.js`.
4. **DynamoDB table** for chat history.
   - TODO suggested keys:
     - Partition key: `PK` (String)
     - Sort key: `SK` (String)

## Environment variables required

Set these on Lambda:
- `OPENAI_API_KEY` (required, backend only)
- `OPENAI_MODEL` (default: `gpt-4.1-nano`)
- `CHAT_HISTORY_TABLE_NAME` (required)
- `CORS_ALLOW_ORIGIN` (recommended)

Set this for frontend build/runtime:
- `VITE_API_BASE_URL` = API Gateway base URL

Never store `OPENAI_API_KEY` in frontend code.

## Request flow

1. User types a message in frontend UI.
2. Frontend `sendChatMessage` POSTs to `POST /chat` on API Gateway.
3. API Gateway invokes Lambda.
4. Lambda loads recent chat history from DynamoDB.
5. Lambda sends history + new user message to OpenAI Responses API.
6. Lambda stores user and assistant messages back in DynamoDB.
7. Lambda returns assistant reply via API Gateway to frontend.

## Notes / TODOs

- TODO: Replace placeholder AWS resource values in `.env.example`.
- TODO: Lock down `CORS_ALLOW_ORIGIN` to your actual Amplify domain.
- TODO: Add authentication/authorization before production use.
- TODO: Add input validation and rate limiting.
- TODO: Add infra-as-code (CDK/SAM/Terraform) for repeatable setup.

## Not deployed yet

As requested, this scaffold does **not** deploy resources automatically.
