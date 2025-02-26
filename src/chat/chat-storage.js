import { ensureChatInterface, addMessageToChatContainer } from './chat-interface.js';

// Helper function to check if extension context is valid
function isExtensionContextValid() {
  try {
    chrome.runtime.getURL('');
    return true;
  } catch (e) {
    return false;
  }
}

export async function saveMessage(message, isUser) {
  // Check context validity first
  if (!isExtensionContextValid()) {
    console.warn('Extension context invalid, cannot save message');
    return;
  }
  
  const currentUrl = window.location.href;
  try {
    const result = await chrome.storage.local.get('chatMessages');
    const urlMessages = result.chatMessages || {};
    
    if (!urlMessages[currentUrl]) {
      urlMessages[currentUrl] = [];
    }
    
    urlMessages[currentUrl].push({
      content: message,
      isUser: isUser,
      timestamp: Date.now()
    });
    
    await chrome.storage.local.set({ chatMessages: urlMessages });
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

export async function loadMessages() {
  // Check context validity first
  if (!isExtensionContextValid()) {
    console.warn('Extension context invalid, cannot load messages');
    return [];
  }
  
  const currentUrl = window.location.href;
  try {
    const result = await chrome.storage.local.get('chatMessages');
    const urlMessages = result.chatMessages || {};
    return urlMessages[currentUrl] || [];
  } catch (error) {
    console.error('Error loading messages:', error);
    return [];
  }
}

export async function displayStoredMessages() {
  try {
    const messages = await loadMessages();
    const elements = await ensureChatInterface();
    
    if (!elements || !elements.messagesContainer) {
      throw new Error('Chat interface not ready');
    }
    
    elements.messagesContainer.innerHTML = '';
    
    for (const message of messages) {
      await addMessageToChatContainer(message.content, message.isUser, false);
    }
  } catch (error) {
    console.warn('Failed to display stored messages:', error);
  }
}
