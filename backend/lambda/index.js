import OpenAI from 'openai';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.CHAT_HISTORY_TABLE_NAME; // TODO: set DynamoDB table name in Lambda env.
const ALLOWED_ORIGIN = process.env.CORS_ALLOW_ORIGIN || '*'; // TODO: set specific frontend origin for production.
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS,POST',
};

export const handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return response(400, { error: 'sessionId and message are required.' });
    }

    if (!TABLE_NAME) {
      return response(500, { error: 'Server misconfiguration: missing CHAT_HISTORY_TABLE_NAME.' });
    }

    const history = await loadHistory(sessionId);

    const responseInput = [
      ...history.map((item) => ({ role: item.role, content: item.content })),
      { role: 'user', content: message },
    ];

    const aiResponse = await openai.responses.create({
      model: MODEL,
      input: responseInput,
    });

    const reply = aiResponse.output_text || 'Sorry, I could not generate a reply.';

    await saveMessage(sessionId, 'user', message);
    await saveMessage(sessionId, 'assistant', reply);

    return response(200, { reply, sessionId });
  } catch (error) {
    console.error('Chat handler error', error);
    return response(500, { error: 'Internal server error.' });
  }
};

function response(statusCode, payload) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(payload),
  };
}

async function saveMessage(sessionId, role, content) {
  const item = {
    PK: `SESSION#${sessionId}`,
    SK: `MSG#${Date.now()}#${Math.random().toString(16).slice(2)}`,
    sessionId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}

async function loadHistory(sessionId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `SESSION#${sessionId}`,
      },
      ScanIndexForward: true,
      Limit: 20,
    })
  );

  return (result.Items || []).map((item) => ({ role: item.role, content: item.content }));
}
