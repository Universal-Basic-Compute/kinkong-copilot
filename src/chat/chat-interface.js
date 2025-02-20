import { formatMessage } from './message-formatter.js';
import { saveMessage } from './chat-storage.js';

export function ensureChatInterface() {
  const INTERFACE_ID = 'kinkong-chat-interface';
  
  // Check if interface already exists
  if (document.getElementById(INTERFACE_ID)) {
    return {
      messagesContainer: document.querySelector('.kinkong-chat-messages'),
      chatContainer: document.querySelector('.kinkong-chat-container'),
      copilotImage: document.querySelector('.kinkong-floating-copilot')
    };
  }

  // If not exists, create it
  try {
    const interfaceContainer = document.createElement('div');
    interfaceContainer.id = INTERFACE_ID;
    document.body.appendChild(interfaceContainer);
    
    injectFloatingCopilot();
    
    // Get references to newly created elements
    const elements = {
      messagesContainer: document.querySelector('.kinkong-chat-messages'),
      chatContainer: document.querySelector('.kinkong-chat-container'),
      copilotImage: document.querySelector('.kinkong-floating-copilot')
    };

    // Verify all elements were created
    if (!elements.messagesContainer || !elements.chatContainer || !elements.copilotImage) {
      throw new Error('Failed to create one or more chat interface elements');
    }

    return elements;
  } catch (error) {
    console.error('Error creating chat interface:', error);
    throw new Error('Failed to create chat interface: ' + error.message);
  }
}

export async function injectFloatingCopilot() {
  return new Promise((resolve, reject) => {
    try {
      // Get saved preference
      chrome.storage.sync.get({ copilotEnabled: true }, (items) => {
        copilotEnabled = items.copilotEnabled;
        
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
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .kinkong-chat-messages::-webkit-scrollbar {
            display: none;
          }

          .kinkong-message {
            margin-bottom: 10px;
            padding: 8px 12px;
            border-radius: 18px;
            max-width: 85%;
            white-space: pre-wrap;
            word-wrap: break-word;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-size: 14px;
            line-height: 1.4;
            display: inline-block;
            width: auto;
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
            display: flex;
            padding: 15px;
            background: rgba(0, 0, 0, 0.2);
            gap: 10px;
          }

          .kinkong-chat-input {
            flex-grow: 1;
            padding: 8px 12px;
            border: 1px solid rgba(255, 215, 0, 0.3);
            border-radius: 20px;
            background: rgba(0, 0, 0, 0.3);
            color: #fff;
            font-size: 14px;
          }

          .kinkong-chat-input:focus {
            outline: none;
            border-color: var(--primary-gold, #ffd700);
          }

          .kinkong-chat-send {
            padding: 8px 15px;
            border: none;
            border-radius: 20px;
            background: linear-gradient(135deg, #ffd700, #ffa502);
            color: #1a1a1a;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s ease;
          }

          .kinkong-chat-send:hover {
            transform: scale(1.05);
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
        img.style.display = copilotEnabled ? 'block' : 'none';
        
        // Wait for image to load
        img.onload = () => {
          document.body.appendChild(img);
          resolve();
        };

        img.onerror = (error) => {
          reject(new Error('Failed to load copilot image: ' + error.message));
        };

        // Add click handlers
        img.addEventListener('click', () => {
          if (chatContainer.classList.contains('visible')) {
            chatContainer.classList.remove('visible');
            setTimeout(() => {
              chatContainer.style.display = 'none';
            }, 300);
            img.style.animation = 'kinkong-float 3s ease-in-out infinite';
          } else {
            chatContainer.style.display = 'flex';
            requestAnimationFrame(() => {
              chatContainer.classList.add('visible');
            });
            img.style.animation = 'none';
          }
        });

        // Add message handlers
        const input = chatContainer.querySelector('.kinkong-chat-input');
        const sendButton = chatContainer.querySelector('.kinkong-chat-send');

        const sendMessage = () => {
          const message = input.value.trim();
          if (message) {
            addMessageToChatContainer(message, true);
            input.value = '';
          }
        };

        sendButton.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            sendMessage();
          }
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function addMessageToChatContainer(message, isUser = true, shouldSave = true) {
  const { messagesContainer, chatContainer, copilotImage } = ensureChatInterface();
  
  if (messagesContainer) {
    if (!chatContainer.classList.contains('visible')) {
      chatContainer.style.display = 'flex';
      requestAnimationFrame(() => {
        chatContainer.classList.add('visible');
      });
    }
    
    if (copilotImage) {
      copilotImage.style.animation = 'none';
    }

    // Split messages only for bot responses (non-user messages)
    if (!isUser) {
      // Split on double line breaks to preserve intended paragraphs
      const paragraphs = message.split(/\n\s*\n/);
      
      // Calculate reading time based on average reading speed (250 words per minute)
      const WORDS_PER_MINUTE = 250;
      const MILLISECONDS_PER_WORD = (60 * 1000) / WORDS_PER_MINUTE;
      
      for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
          // Add the message bubble
          messagesContainer.innerHTML += `
            <div class="kinkong-message ${isUser ? 'user' : 'bot'}" style="opacity: 0; transform: translateY(10px); transition: all 0.3s ease">
              ${formatMessage(paragraph.trim())}
            </div>
          `;
          
          // Get the newly added message bubble
          const newBubble = messagesContainer.lastElementChild;
          
          // Trigger animation
          await new Promise(resolve => setTimeout(() => {
            newBubble.style.opacity = '1';
            newBubble.style.transform = 'translateY(0)';
            resolve();
          }, 100));

          // Calculate delay based on word count
          const wordCount = paragraph.trim().split(/\s+/).length;
          const readingDelay = Math.max(500, wordCount * MILLISECONDS_PER_WORD);
          
          // Wait for reading time before showing next bubble
          await new Promise(resolve => setTimeout(resolve, readingDelay));
        }
      }
    } else {
      // User messages remain unchanged - single bubble
      messagesContainer.innerHTML += `
        <div class="kinkong-message ${isUser ? 'user' : 'bot'}">
          ${formatMessage(message)}
        </div>
      `;
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    if (shouldSave) {
      saveMessage(message, isUser);
    }
  }
}
