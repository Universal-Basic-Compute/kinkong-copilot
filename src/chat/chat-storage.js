export async function saveMessage(message, isUser) {
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
  const messages = await loadMessages();
  const { messagesContainer } = ensureChatInterface();
  
  messagesContainer.innerHTML = '';
  
  messages.forEach(message => {
    addMessageToChatContainer(message.content, message.isUser, false);
  });
}
