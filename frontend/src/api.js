const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || window.__API_BASE_URL__;

export async function sendChatMessage({ chatId, message }) {
  if (!API_BASE_URL) {
    throw new Error('Missing API base URL. TODO: set VITE_API_BASE_URL for frontend.');
  }

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chatId, message }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API request failed: ${response.status} ${text}`);
  }

  return response.json();
}
