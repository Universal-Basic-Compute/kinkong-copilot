// Track when marked is loaded
let markedReady = false;

// Load marked.min.js into the content script context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('lib/marked.min.js');
script.onload = () => {
  // Create a wrapper function to access marked in the window context
  window.formatMarkdown = (text) => {
    return window.marked.parse(text, {
      breaks: true,
      gfm: true,
      sanitize: true
    });
  };
  markedReady = true;
};
(document.head || document.documentElement).appendChild(script);

// Helper function for markdown formatting
function formatMessage(text) {
  if (markedReady && window.formatMarkdown) {
    return window.formatMarkdown(text);
  }
  return text; // Fallback if marked isn't loaded yet
}


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
      border-radius: 15px;
      z-index: 999998;
      display: none;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
    }

    .kinkong-chat-container.visible {
      opacity: 1;
      transform: translateY(0);
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
      white-space: pre-wrap;
      word-wrap: break-word;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .kinkong-message code {
      background: rgba(0,0,0,0.1);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
    }

    .kinkong-message pre {
      background: rgba(0,0,0,0.1);
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
    }

    .kinkong-message a {
      color: #0366d6;
      text-decoration: none;
    }

    .kinkong-message a:hover {
      text-decoration: underline;
    }

    .kinkong-message ul, .kinkong-message ol {
      padding-left: 20px;
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
      display: flex;
      gap: 12px;
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

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 8px 12px;
      align-items: center;
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      background: #1a1a1a;
      border-radius: 50%;
      opacity: 0.7;
    }

    .typing-dot:nth-child(1) { animation: typingDot 1s infinite 0s; }
    .typing-dot:nth-child(2) { animation: typingDot 1s infinite 0.2s; }
    .typing-dot:nth-child(3) { animation: typingDot 1s infinite 0.4s; }

    @keyframes typingDot {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
  `;
  document.head.appendChild(style);

  // Create chat container
  const chatContainer = document.createElement('div');
  chatContainer.className = 'kinkong-chat-container';
  chatContainer.innerHTML = `
    <div class="kinkong-chat-messages"></div>
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
    if (chatContainer.classList.contains('visible')) {
      // If chat is open, close it
      chatContainer.style.display = 'flex';
      // Wait a tiny bit for display:flex to take effect
      requestAnimationFrame(() => {
        chatContainer.classList.remove('visible');
      });
      // Wait for animation to complete before hiding
      setTimeout(() => {
        chatContainer.style.display = 'none';
      }, 300);
      img.style.animation = 'kinkong-float 3s ease-in-out infinite';
    } else {
      // If chat is closed, open it
      chatContainer.style.display = 'flex';
      // Wait a tiny bit for display:flex to take effect
      requestAnimationFrame(() => {
        chatContainer.classList.add('visible');
      });
      img.style.animation = 'none';
    }
  });


  const input = chatContainer.querySelector('.kinkong-chat-input');
  const sendButton = chatContainer.querySelector('.kinkong-chat-send');
  const messagesContainer = chatContainer.querySelector('.kinkong-chat-messages');

  async function sendMessage() {
    const message = input.value.trim();
    if (message) {
      // Add user message to chat
      messagesContainer.innerHTML += `
        <div class="kinkong-message user">
            ${formatMessage(message)}
        </div>
      `;
      input.value = '';
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Add loading indicator
      const loadingId = 'loading-' + Date.now();
      messagesContainer.innerHTML += `
        <div id="${loadingId}" class="kinkong-message bot typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
      `;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      try {
        // Make API call to KinKong Copilot
        const response = await fetch('https://swarmtrade.ai/api/copilot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: message,
            url: window.location.href
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Remove loading message
        document.getElementById(loadingId).remove();

        // Create a new message div for the streaming response
        const responseDiv = document.createElement('div');
        responseDiv.className = 'kinkong-message bot';
        messagesContainer.appendChild(responseDiv);

        // Set up the stream reader
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = '';

        while (true) {
          const {value, done} = await reader.read();
          if (done) break;
          
          // Decode and append new chunk
          const chunk = decoder.decode(value, {stream: true});
          responseText += chunk;
          responseDiv.innerHTML = formatMessage(responseText);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      } catch (error) {
        console.error('API Error:', error);
        
        // Remove loading message
        document.getElementById(loadingId).remove();

        // Show error message
        messagesContainer.innerHTML += `
          <div class="kinkong-message bot" style="background: linear-gradient(135deg, #e74c3c, #c0392b);">
              ${marked.parse('Sorry, I\'m having trouble connecting right now. Please try again later.')}
          </div>
        `;
      }
      
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
