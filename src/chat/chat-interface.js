import { formatMessage } from './message-formatter.js';
import { saveMessage } from './chat-storage.js';

// Cache for interface elements
let interfaceElements = null;

export async function ensureChatInterface() {
  // Return cached elements if they exist
  if (interfaceElements) {
    return interfaceElements;
  }

  console.group('Chat Interface Initialization');
  console.log('Checking for existing interface...');
  
  try {
    // First check if container exists
    let shadowContainer = document.getElementById('kinkong-shadow-container');
    let shadow;

    if (!shadowContainer) {
      // Create new container and shadow root
      shadowContainer = document.createElement('div');
      shadowContainer.id = 'kinkong-shadow-container';
      document.body.appendChild(shadowContainer);
      shadow = shadowContainer.attachShadow({ mode: 'open' });
      
      // Initialize the interface
      await initializeChatInterface(shadow);
    } else {
      // Get existing shadow root
      shadow = shadowContainer.shadowRoot;
      if (!shadow) {
        shadow = shadowContainer.attachShadow({ mode: 'closed' });
        await initializeChatInterface(shadow);
      }
    }

    // Cache and return interface elements
    interfaceElements = {
      messagesContainer: shadow.querySelector('.kinkong-chat-messages'),
      chatContainer: shadow.querySelector('.kinkong-chat-container'),
      copilotImage: shadow.querySelector('.kinkong-floating-copilot')
    };

    // Verify all elements exist
    if (!interfaceElements.messagesContainer || !interfaceElements.chatContainer || !interfaceElements.copilotImage) {
      throw new Error('Missing interface elements');
    }

    console.log('Interface ready');
    console.groupEnd();
    return interfaceElements;

  } catch (error) {
    console.error('Error ensuring chat interface:', error);
    console.groupEnd();
    throw new Error('Failed to create chat interface: ' + error.message);
  }
}

async function initializeChatInterface(shadow) {
  // Get saved preference
  const { copilotEnabled } = await chrome.storage.sync.get({ copilotEnabled: true });
        
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .kinkong-chat-container {
      position: fixed;
      bottom: 140px;
      right: 30px;
      width: 380px;
      height: 500px;
      background: rgba(26, 26, 26, 0.85);
      border: 1px solid rgba(255, 215, 0, 0.2);
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 5px 20px rgba(0,0,0,0.5);
      display: none;
      flex-direction: column;
      z-index: 999999;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s ease;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .kinkong-chat-container.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .kinkong-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      scroll-behavior: smooth;
    }

    .kinkong-chat-input-container {
      padding: 15px;
      border-top: 1px solid rgba(255, 215, 0, 0.2);
      display: flex;
      gap: 12px;
      background: rgba(26, 26, 26, 0.85);
      border-radius: 0 0 12px 12px;
    }

    .kinkong-chat-input {
      flex: 1;
      padding: 12px;
      border: 1px solid rgba(255, 215, 0, 0.3);
      border-radius: 8px;
      background: rgba(45, 45, 45, 0.8);
      color: white;
      font-size: 14px;
      transition: all 0.3s ease;
    }

    .kinkong-chat-input:focus {
      outline: none;
      border-color: #ffd700;
      box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.2);
    }

    .kinkong-chat-send {
      padding: 12px 20px;
      background: linear-gradient(135deg, #e31837, #ffd700);
      border: none;
      border-radius: 8px;
      color: black;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .kinkong-chat-send:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3);
      background: linear-gradient(135deg, #FFA500, #FF8C00);
    }

    .kinkong-floating-copilot {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 90px;
      height: 90px;
      cursor: pointer;
      z-index: 999999;
      animation: kinkong-float 3s ease-in-out infinite;
      filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
      transition: all 0.3s ease;
    }

    .kinkong-floating-copilot:hover {
      transform: scale(1.1);
      filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));
    }

    @keyframes kinkong-float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }

    .kinkong-message {
      margin-bottom: 15px;
      padding: 12px 16px;
      border-radius: 12px;
      max-width: 85%;
      word-wrap: break-word;
      line-height: 1.4;
      font-size: 14px;
      animation: message-fade-in 0.3s ease;
    }

    @keyframes message-fade-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .kinkong-message.user {
      background: linear-gradient(135deg, #e31837, #ff4757);
      margin-left: auto;
      color: white;
      border-bottom-right-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }

    .kinkong-message.bot {
      background: linear-gradient(135deg, #ffd700, #ffa502);
      margin-right: auto;
      color: #1a1a1a;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }

    .typing-indicator {
      display: flex;
      gap: 5px;
      padding: 12px;
      background: rgba(51, 51, 51, 0.8);
      border-radius: 12px;
      margin-bottom: 15px;
      width: fit-content;
    }

    .typing-dot {
      width: 8px;
      height: 8px;
      background: #FFD700;
      border-radius: 50%;
      animation: typing 1s infinite ease-in-out;
    }

    .typing-dot:nth-child(1) { animation-delay: 0s; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }

    /* Scrollbar styles */
    .kinkong-chat-messages {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .kinkong-chat-messages::-webkit-scrollbar {
      display: none;
    }
  `;
  shadow.appendChild(style);

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
  shadow.appendChild(chatContainer);

  // Create copilot image
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('assets/copilot.png');
  img.className = 'kinkong-floating-copilot';
  img.alt = 'KinKong Copilot';
  img.style.display = copilotEnabled ? 'block' : 'none';
  shadow.appendChild(img);

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

  // Wait for image to load
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load copilot image'));
  });
}

// Helper function to check if element is fully visible at top
function isElementFullyVisibleAtTop(element, container) {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  
  // Get the actual top position relative to the container
  const elementTop = elementRect.top - containerRect.top;
  
  // Check if element starts at or below the container's top edge
  return elementTop >= 0;
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

    // Function to smoothly scroll to an element
    const smoothScrollToElement = (element) => {
      const targetPosition = element.offsetTop;
      const startPosition = messagesContainer.scrollTop;
      const distance = targetPosition - startPosition;
      const duration = 300; // ms
      let start = null;
      
      const animation = (currentTime) => {
        if (!start) start = currentTime;
        const progress = currentTime - start;
        const percentage = Math.min(progress / duration, 1);
        
        // Easing function for smooth animation
        const easeOutCubic = percentage => 1 - Math.pow(1 - percentage, 3);
        
        messagesContainer.scrollTop = startPosition + distance * easeOutCubic(percentage);
        
        if (percentage < 1) {
          requestAnimationFrame(animation);
        }
      };
      
      requestAnimationFrame(animation);
    };

    // Split messages only for bot responses (non-user messages)
    if (!isUser) {
      const paragraphs = message.split(/\n\s*\n/);
      const WORDS_PER_MINUTE = 250;
      const MILLISECONDS_PER_WORD = (60 * 1000) / WORDS_PER_MINUTE;
      
      for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
          const tempDiv = document.createElement('div');
          tempDiv.className = `kinkong-message ${isUser ? 'user' : 'bot'}`;
          tempDiv.style.opacity = '0';
          tempDiv.style.transform = 'translateY(10px)';
          tempDiv.style.transition = 'all 0.3s ease';
          tempDiv.innerHTML = formatMessage(paragraph.trim());
          
          messagesContainer.appendChild(tempDiv);
          
          // Check if the new bubble is fully visible at the top
          if (!isElementFullyVisibleAtTop(tempDiv, messagesContainer)) {
            tempDiv.remove();
            continue;
          }
          
          // Trigger fade-in animation and scroll
          await new Promise(resolve => setTimeout(() => {
            tempDiv.style.opacity = '1';
            tempDiv.style.transform = 'translateY(0)';
            
            // Smooth scroll to the new message
            tempDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            resolve();
          }, 100));

          const wordCount = paragraph.trim().split(/\s+/).length;
          const readingDelay = Math.max(500, wordCount * MILLISECONDS_PER_WORD);
          await new Promise(resolve => setTimeout(resolve, readingDelay));
        }
      }
    } else {
      // User messages
      const tempDiv = document.createElement('div');
      tempDiv.className = `kinkong-message ${isUser ? 'user' : 'bot'}`;
      tempDiv.innerHTML = formatMessage(message);
      
      messagesContainer.appendChild(tempDiv);
      
      // Check if the new bubble is fully visible at the top
      if (!isElementFullyVisibleAtTop(tempDiv, messagesContainer)) {
        tempDiv.remove();
        return;
      }
      
      // Smooth scroll to the new message
      tempDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    if (shouldSave) {
      saveMessage(message, isUser);
    }
  }
}
