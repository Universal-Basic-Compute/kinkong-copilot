function injectFloatingCopilot() {
  const style = document.createElement('style');
  style.textContent = `
    .kinkong-floating-copilot {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 80px;
      height: 80px;
      z-index: 999999;
      animation: kinkong-float 3s ease-in-out infinite;
      cursor: pointer;
    }

    @keyframes kinkong-float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }

    .kinkong-chat-container {
      position: fixed;
      bottom: 130px;
      right: 30px;
      width: 300px;
      height: 400px;
      background-color: #1a1a1a;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
      z-index: 999998;
      display: none;
      flex-direction: column;
      overflow: hidden;
    }

    .kinkong-chat-header {
      padding: 15px;
      background-color: #2d2d2d;
      color: #ffd700;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .kinkong-chat-close {
      cursor: pointer;
      color: #888;
      font-size: 20px;
    }

    .kinkong-chat-messages {
      flex-grow: 1;
      padding: 15px;
      overflow-y: auto;
      color: #fff;
    }

    .kinkong-chat-input-container {
      padding: 15px;
      background-color: #2d2d2d;
      display: flex;
      gap: 10px;
    }

    .kinkong-chat-input {
      flex-grow: 1;
      padding: 8px;
      border: none;
      border-radius: 5px;
      background-color: #1a1a1a;
      color: #fff;
      outline: none;
    }

    .kinkong-chat-send {
      padding: 8px 15px;
      background-color: #ffd700;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      color: #1a1a1a;
      font-weight: bold;
    }

    .kinkong-chat-send:hover {
      background-color: #ffed4a;
    }
  `;
  document.head.appendChild(style);

  // Create chat container
  const chatContainer = document.createElement('div');
  chatContainer.className = 'kinkong-chat-container';
  chatContainer.innerHTML = `
    <div class="kinkong-chat-header">
      <span>KinKong Copilot</span>
      <span class="kinkong-chat-close">×</span>
    </div>
    <div class="kinkong-chat-messages">
      <div style="color: #888;">Ask me anything about trading...</div>
    </div>
    <div class="kinkong-chat-input-container">
      <input type="text" class="kinkong-chat-input" placeholder="Type your message...">
      <button class="kinkong-chat-send">Send</button>
    </div>
  `;
  document.body.appendChild(chatContainer);

  // Create floating copilot
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('assets/copilot.png');
  img.className = 'kinkong-floating-copilot';
  img.alt = 'KinKong Copilot';
  document.body.appendChild(img);

  // Add click handlers
  img.addEventListener('click', () => {
    chatContainer.style.display = 'flex';
    img.style.animation = 'none'; // Stop floating when chat is open
  });

  const closeButton = chatContainer.querySelector('.kinkong-chat-close');
  closeButton.addEventListener('click', () => {
    chatContainer.style.display = 'none';
    img.style.animation = 'kinkong-float 3s ease-in-out infinite'; // Resume floating
  });

  const input = chatContainer.querySelector('.kinkong-chat-input');
  const sendButton = chatContainer.querySelector('.kinkong-chat-send');
  const messagesContainer = chatContainer.querySelector('.kinkong-chat-messages');

  function sendMessage() {
    const message = input.value.trim();
    if (message) {
      messagesContainer.innerHTML += `
        <div style="margin-bottom: 10px;">
          <div style="color: #888;">You:</div>
          <div>${message}</div>
        </div>
      `;
      input.value = '';
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      // TODO: Add actual chat API integration here
      // For now, just show a mock response
      setTimeout(() => {
        messagesContainer.innerHTML += `
          <div style="margin-bottom: 10px;">
            <div style="color: #ffd700;">KinKong:</div>
            <div>I'm processing your question about "${message}". Integration with AI coming soon!</div>
          </div>
        `;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 1000);
    }
  }

  sendButton.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
}

injectFloatingCopilot();
