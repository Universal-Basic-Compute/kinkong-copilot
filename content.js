function injectFloatingCopilot() {
  const style = document.createElement('style');
  style.textContent = `
    .kinkong-floating-copilot {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 90px;
      height: 90px;
      z-index: 999999;
      animation: kinkong-float 3s ease-in-out infinite;
      cursor: pointer;
      transition: transform 0.3s ease;
    }

    .kinkong-floating-copilot:hover {
      transform: scale(1.1);
    }

    @keyframes kinkong-float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }

    .kinkong-chat-container {
      position: fixed;
      bottom: 140px;
      right: 30px;
      width: 380px;
      height: 500px;
      background-color: #1a1a1a;
      border-radius: 15px;
      box-shadow: 0 5px 25px rgba(0,0,0,0.4);
      z-index: 999998;
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid rgba(255, 215, 0, 0.2);
    }

    .kinkong-chat-header {
      padding: 12px 20px;
      background: linear-gradient(135deg, rgba(227, 24, 55, 0.8), rgba(255, 215, 0, 0.8));
      color: white;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
      height: 24px;
    }

    .kinkong-chat-close {
      cursor: pointer;
      color: white;
      font-size: 24px;
      transition: transform 0.3s ease;
    }

    .kinkong-chat-close:hover {
      transform: rotate(90deg);
    }

    .kinkong-chat-messages {
      flex-grow: 1;
      padding: 20px;
      overflow-y: auto;
      color: #fff;
    }

    .kinkong-message {
      margin-bottom: 15px;
      padding: 12px 16px;
      border-radius: 10px;
      max-width: 85%;
      transition: transform 0.2s ease;
    }

    .kinkong-message:hover {
      transform: translateX(5px);
    }

    .kinkong-message.user {
      background: linear-gradient(135deg, #e31837, #ff4757);
      margin-left: auto;
      border-bottom-right-radius: 4px;
    }

    .kinkong-message.bot {
      background: linear-gradient(135deg, #ffd700, #ffa502);
      color: #1a1a1a;
      margin-right: auto;
      border-bottom-left-radius: 4px;
    }

    .kinkong-chat-input-container {
      padding: 20px;
      background-color: #2d2d2d;
      display: flex;
      gap: 12px;
      border-top: 1px solid rgba(255, 215, 0, 0.1);
    }

    .kinkong-chat-input {
      flex-grow: 1;
      padding: 12px;
      border: 2px solid rgba(255, 215, 0, 0.2);
      border-radius: 8px;
      background-color: #1a1a1a;
      color: #fff;
      outline: none;
      transition: border-color 0.3s ease;
      font-size: 14px;
    }

    .kinkong-chat-input:focus {
      border-color: #ffd700;
    }

    .kinkong-chat-send {
      padding: 12px 20px;
      background: linear-gradient(135deg, #e31837, #ffd700);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      color: white;
      font-weight: bold;
      transition: all 0.3s ease;
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }

    .kinkong-chat-send:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
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
    if (chatContainer.style.display === 'flex') {
      // If chat is open, close it
      chatContainer.style.display = 'none';
      img.style.animation = 'kinkong-float 3s ease-in-out infinite';
    } else {
      // If chat is closed, open it
      chatContainer.style.display = 'flex';
      img.style.animation = 'none';
    }
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
          <div class="kinkong-message user">
              ${message}
          </div>
      `;
      input.value = '';
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      setTimeout(() => {
          messagesContainer.innerHTML += `
              <div class="kinkong-message bot">
                  I'm processing your question about "${message}". Integration with AI coming soon!
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
