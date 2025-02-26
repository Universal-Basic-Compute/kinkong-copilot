import { formatMessage } from './message-formatter.js';
import { saveMessage } from './chat-storage.js';
import { makeApiCall } from '../api/api-client.js';
import { showMessageParagraphs } from '../handlers/url-handler.js';
import { isSupportedPage } from '../content/page-detector.js';

// Message queue system
let messageQueue = [];
let isProcessingQueue = false;

// Fonction utilitaire pour vérifier si le contexte est valide
function isExtensionContextValid() {
  return typeof chrome !== 'undefined' && chrome?.runtime?.id;
}



async function processMessageQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (messageQueue.length > 0) {
    const { message, isUser, shouldSave, shadow } = messageQueue[0];
    
    try {
      const elements = await ensureChatInterface();
      if (!elements || !elements.messagesContainer) {
        throw new Error('Chat interface not ready');
      }

      const { messagesContainer } = elements;
      
      // For user messages or initial messages, add them instantly
      if (isUser || shouldSave === false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `kinkong-message ${isUser ? 'user' : 'bot'}`;
        messageDiv.innerHTML = formatMessage(message);
        messagesContainer.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        await addMessageParagraphsToChat(message, isUser, messagesContainer);
      }

      if (shouldSave) {
        saveMessage(message, isUser);
      }

      if (shadow) {
        await showMessageParagraphs(message, shadow);
      }
      
      messageQueue.shift();
      
    } catch (error) {
      console.error('Error processing message:', error);
      messageQueue.shift(); // Remove failed message and continue
    }
  }
  
  isProcessingQueue = false;
}


// Cache for interface elements
// Wallet ID management
export async function getOrCreateWalletId() {
  try {
    // Check if ID exists in storage
    const result = await chrome.storage.local.get('walletId');
    
    // Return existing ID if valid
    if (result.walletId && result.walletId !== '803c7488f8632c0b9506c6f2fec75405') {
      return result.walletId;
    }

    // Generate new random code
    const buffer = new Uint8Array(32);
    crypto.getRandomValues(buffer);
    
    // Convert to 32-char hex string
    const walletId = Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 32);

    // Save to local storage
    await chrome.storage.local.set({ walletId: walletId });

    return walletId;
  } catch (error) {
    console.error('Error managing wallet ID:', error);
    return '803c7488f8632c0b9506c6f2fec75405'; // Default code if error
  }
}

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
    // Check rate limit state when initializing
    const result = await chrome.storage.local.get('rateLimitState');
    if (result.rateLimitState) {
      const { endTime } = result.rateLimitState;
      const now = Date.now();
      
      if (now < endTime) {
        // Still rate limited
        const remainingTime = getRemainingHoursText(endTime);
        const input = interfaceElements.chatContainer.querySelector('.kinkong-chat-input');
        const sendButton = interfaceElements.chatContainer.querySelector('.kinkong-chat-send');
        
        if (input) {
          input.disabled = true;
          input.placeholder = `Chat will be re-enabled in ${remainingTime}...`;
        }
        
        if (sendButton) {
          sendButton.disabled = true;
          sendButton.style.opacity = '0.5';
        }
      } else {
        // Reset has passed
        await manageRateLimitState(false);
      }
    }

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
      width: 100px;
      height: 100px;
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
      user-select: text;
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      cursor: text;
    }

    .kinkong-message a {
      color: #3498db;
      text-decoration: underline;
      transition: all 0.2s ease;
    }

    .kinkong-message a:hover {
      color: #2980b9;
      text-decoration: none;
    }

    .kinkong-message.bot a {
      color: #3498db;
    }

    .kinkong-message.bot a:hover {
      color: #2980b9;
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

    .rate-limit-message {
      background: linear-gradient(135deg, #2d3436, #2d3436) !important;
      color: #fff !important;
      border: 1px solid rgba(255, 215, 0, 0.3);
    }

    .rate-limit-message ul {
      color: #bbb;
    }

    .rate-limit-message a:hover {
      box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
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
      user-select: text;
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
      cursor: text;
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
        // Get wallet ID and page type
        const walletId = await getOrCreateWalletId();
        const pageType = isSupportedPage();

        // Use the currentPageContent from content.js
        const response = await makeApiCall('copilot', {
          message: message,
          url: window.location.href,
          pageContent: window.currentPageContent || null,
          pageType: pageType || null,
          fullyLoaded: true,
          wallet: walletId // Use generated wallet ID
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

        // Pour toutes les erreurs, on affiche juste le message par défaut
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


function setupActivityTracking(shadow) {
  // This function is intentionally empty as we've removed the auto-messaging functionality
  // No automatic API calls will be made when the user visits a page
}

export async function addMessageToChatContainer(message, isUser = true, shouldSave = true) {
  // Add to queue
  messageQueue.push({ message, isUser, shouldSave });
  
  // Start processing if not already running
  if (!isProcessingQueue) {
    processMessageQueue();
  }
}
