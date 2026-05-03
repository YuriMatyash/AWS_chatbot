import { sendChatMessage } from './api.js';

const chatWindow = document.getElementById('chatWindow');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');

const sessionId = crypto.randomUUID();

function renderMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = content;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  renderMessage('user', message);
  messageInput.value = '';

  try {
    const result = await sendChatMessage({ sessionId, message });
    renderMessage('assistant', result.reply || '(No response)');
  } catch (error) {
    renderMessage('assistant', `Error: ${error.message}`);
  }
});
