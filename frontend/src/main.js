import { sendChatMessage } from './api.js';

const chatWindow = document.getElementById('chatWindow');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const submitButton = chatForm.querySelector('button[type="submit"]');

const CHAT_ID_STORAGE_KEY = 'aws_chatbot_chat_id';
let chatId = sessionStorage.getItem(CHAT_ID_STORAGE_KEY) || crypto.randomUUID();
sessionStorage.setItem(CHAT_ID_STORAGE_KEY, chatId);

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
  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';

  try {
    const result = await sendChatMessage({ chatId, message });
    if (result.chatId && result.chatId !== chatId) {
      chatId = result.chatId;
      sessionStorage.setItem(CHAT_ID_STORAGE_KEY, chatId);
    }
    renderMessage('assistant', result.reply || '(No response)');
  } catch (error) {
    renderMessage('assistant', `Error: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Send';
    messageInput.focus();
  }
});
