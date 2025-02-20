import { formatMessage } from './message-formatter.js';
import { saveMessage } from './chat-storage.js';
import { makeApiCall } from '../api/api-client.js';
import { showMessageParagraphs } from '../handlers/url-handler.js';

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

    .kinkong-speech-bubble {
      position: fixed;
      bottom: 140px;
      right: 30px;
      background: linear-gradient(135deg, #ffd700, #ffa502);
      color: #1a1a1a;
      padding: 15px 20px;
      border-radius: 12px;
      max-width: 280px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      font-size: 14px;
      line-height: 1.4;
      z-index: 999998;
      animation: bubble-pop-in 0.3s ease;
      transform-origin: bottom right;
    }

    .kinkong-speech-bubble:after {
      content: '';
      position: absolute;
      bottom: -10px;
      right: 40px;
      border-width: 10px 10px 0;
      border-style: solid;
      border-color: #ffa502 transparent transparent;
    }

    @keyframes bubble-pop-in {
      from {
        opacity: 0;
        transform: scale(0.8) translateY(10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes bubble-fade-out {
      from {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      to {
        opacity: 0;
        transform: scale(0.8) translateY(10px);
      }
    }

    .kinkong-speech-bubble.fade-out {
      animation: bubble-fade-out 0.3s ease forwards;
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
        // Scroll to bottom when opening
        const messagesContainer = chatContainer.querySelector('.kinkong-chat-messages');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      });
      img.style.animation = 'none';
    }
  });

  // Add message handlers
  const input = chatContainer.querySelector('.kinkong-chat-input');
  const sendButton = chatContainer.querySelector('.kinkong-chat-send');

  const sendMessage = async () => {
    const message = input.value.trim();
    if (message) {
      // Get interface elements first
      const { messagesContainer } = await ensureChatInterface();
      if (!messagesContainer) {
        console.error('Messages container not found');
        return;
      }

      // Add user message to chat
      addMessageToChatContainer(message, true);
      input.value = '';

      // Add loading indicator
      const loadingId = 'loading-' + Date.now();
      const loadingIndicator = document.createElement('div');
      loadingIndicator.id = loadingId;
      loadingIndicator.className = 'typing-indicator';
      loadingIndicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      `;
      messagesContainer.appendChild(loadingIndicator);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      try {
        // Make API call
        const response = await makeApiCall('copilot', {
          message: message,
          url: window.location.href,
          pageContent: null,
          pageType: null,
          fullyLoaded: true
        });

        // Remove loading indicator
        const loadingElement = messagesContainer.querySelector(`#${loadingId}`);
        if (loadingElement) {
          loadingElement.remove();
        }

        const responseText = await response.text();
        
        // Get shadow root for bubble display
        const shadowContainer = document.getElementById('kinkong-shadow-container');
        if (!shadowContainer || !shadowContainer.shadowRoot) {
          throw new Error('Shadow container not found');
        }
        const shadow = shadowContainer.shadowRoot;

        // Add full message to chat history
        addMessageToChatContainer(responseText, false);

        // Show paragraphs one by one in bubbles
        await showMessageParagraphs(responseText, shadow);

      } catch (error) {
        console.error('API Error:', error);
        document.getElementById(loadingId)?.remove();
        addMessageToChatContainer(
          "Sorry, I'm having trouble connecting right now. Please try again later.",
          false
        );
      }
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

  // Setup activity tracking
  setupActivityTracking(shadow);
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

function getReadingTime(text) {
  // Slower reading speed: 120 words per minute, or about 10 chars per second
  const charsPerSecond = 10;
  
  // Minimum 2 seconds, maximum 6 seconds per paragraph
  return Math.max(2000, Math.min(6000, (text.length / charsPerSecond) * 1000));
}

async function addMessageParagraphsToChat(message, isUser, messagesContainer) {
  // Split message into paragraphs (same as speech bubbles)
  const paragraphs = message.split(/\n\n|(?=#{1,6}\s)/g)
    .filter(p => p.trim().length > 0);
  
  for (const paragraph of paragraphs) {
    // Create message element for this paragraph
    const messageDiv = document.createElement('div');
    messageDiv.className = `kinkong-message ${isUser ? 'user' : 'bot'}`;
    messageDiv.innerHTML = formatMessage(paragraph);
    
    // Add to container
    messagesContainer.appendChild(messageDiv);
    
    // Scroll into view smoothly
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Wait for reading time before next paragraph
    if (!isUser) {  // Only delay for bot messages
      const readingTime = getReadingTime(paragraph);
      await new Promise(resolve => setTimeout(resolve, readingTime));
    }
  }
}

function handleUserActivity() {
  // Clear existing timeouts
  if (userActivityTimeout) {
    clearTimeout(userActivityTimeout);
  }

  // Reset the activity timeout
  userActivityTimeout = setTimeout(() => {
    // Stop sending messages after inactivity
    if (messageInterval) {
      clearInterval(messageInterval);
      messageInterval = null;
    }
  }, ACTIVITY_TIMEOUT);

  // Start interval if not already running
  if (!messageInterval) {
    messageInterval = setInterval(async () => {
      const elements = await ensureChatInterface();
      if (!elements || !elements.chatContainer) return;

      // Only send if chat is open
      if (elements.chatContainer.classList.contains('visible')) {
        const message = "what else?";
        addMessageToChatContainer(message, true);

        try {
          const response = await makeApiCall('copilot', {
            message: message,
            url: window.location.href,
            pageContent: null,
            pageType: null,
            fullyLoaded: true
          });

          const responseText = await response.text();
          
          // Get shadow root for bubble display
          const shadowContainer = document.getElementById('kinkong-shadow-container');
          if (!shadowContainer || !shadowContainer.shadowRoot) {
            throw new Error('Shadow container not found');
          }
          const shadow = shadowContainer.shadowRoot;

          // Add response to chat
          addMessageToChatContainer(responseText, false);

          // Show paragraphs one by one in bubbles
          await showMessageParagraphs(responseText, shadow);

        } catch (error) {
          console.error('Auto-message API Error:', error);
          addMessageToChatContainer(
            "Sorry, I'm having trouble connecting right now.",
            false
          );
        }
      }
    }, MESSAGE_INTERVAL);
  }
}

function setupActivityTracking(shadow) {
  // Track user activity
  const activityEvents = ['mousedown', 'keydown', 'mousemove', 'wheel', 'touchstart'];
  
  activityEvents.forEach(eventType => {
    shadow.addEventListener(eventType, handleUserActivity, { passive: true });
    document.addEventListener(eventType, handleUserActivity, { passive: true });
  });

  // Start tracking immediately
  handleUserActivity();

  // Clean up on page unload
  window.addEventListener('unload', () => {
    if (messageInterval) clearInterval(messageInterval);
    if (userActivityTimeout) clearTimeout(userActivityTimeout);
  });
}

export async function addMessageToChatContainer(message, isUser = true, shouldSave = true) {
  const elements = await ensureChatInterface();
  
  if (!elements || !elements.messagesContainer) {
    console.error('Chat interface not ready');
    return;
  }

  const { messagesContainer } = elements;
  
  console.log('Adding message:', {
    message,
    isUser,
    containerExists: !!messagesContainer,
    messageLength: message.length
  });

  // Add paragraphs with delay
  await addMessageParagraphsToChat(message, isUser, messagesContainer);

  // Save if needed
  if (shouldSave) {
    saveMessage(message, isUser);
  }
}
