import { formatMessage } from './message-formatter.js';
import { saveMessage } from './chat-storage.js';
import { makeApiCall } from '../api/api-client.js';
import { showMessageParagraphs } from '../handlers/url-handler.js';
import { isSupportedPage } from '../content/page-detector.js';

const RATE_LIMIT_RESET_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

// Message queue system
let messageQueue = [];
let isProcessingQueue = false;

// Function to get remaining hours text
function getRemainingHoursText(endTime) {
  const now = Date.now();
  const hoursRemaining = Math.ceil((endTime - now) / (60 * 60 * 1000));
  return hoursRemaining <= 1 ? '1 hour' : `${hoursRemaining} hours`;
}

// Function to manage rate limit state
async function manageRateLimitState(isLimited = true) {
  try {
    if (isLimited) {
      const now = Date.now();
      await chrome.storage.local.set({
        rateLimitState: {
          isLimited: true,
          startTime: now,
          endTime: now + RATE_LIMIT_RESET_INTERVAL
        }
      });
    } else {
      // Clear rate limit state
      await chrome.storage.local.remove('rateLimitState');
      
      // Re-enable chat interface
      const elements = await ensureChatInterface();
      if (elements && elements.chatContainer) {
        const input = elements.chatContainer.querySelector('.kinkong-chat-input');
        const sendButton = elements.chatContainer.querySelector('.kinkong-chat-send');
        
        if (input) {
          input.disabled = false;
          input.placeholder = 'Type your message...';
        }
        
        if (sendButton) {
          sendButton.disabled = false;
          sendButton.style.opacity = '1';
        }
        
        // Remove rate limit message if it exists
        const rateLimitMessage = elements.messagesContainer.querySelector('.rate-limit-message');
        if (rateLimitMessage) {
          rateLimitMessage.remove();
        }
      }
    }
  } catch (error) {
    console.error('Error managing rate limit state:', error);
  }
}

// Function to check and reset rate limit
async function checkAndResetRateLimit() {
  try {
    const result = await chrome.storage.local.get('rateLimitState');
    if (result.rateLimitState) {
      const { endTime } = result.rateLimitState;
      const now = Date.now();
      
      if (now >= endTime) {
        await manageRateLimitState(false);
      }
    }
  } catch (error) {
    console.error('Error checking rate limit:', error);
  }
}

// Set up periodic check
setInterval(checkAndResetRateLimit, 60000); // Check every minute

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
        // Use paragraph-by-paragraph display for received messages
        await addMessageParagraphsToChat(message, isUser, messagesContainer);
      }

      // Save if needed
      if (shouldSave) {
        saveMessage(message, isUser);
      }

      // If there's a shadow, show speech bubbles
      if (shadow) {
        await showMessageParagraphs(message, shadow);
      }
      
      // Remove processed message from queue
      messageQueue.shift();
      
    } catch (error) {
      console.error('Error processing message:', error);
      messageQueue.shift(); // Remove failed message and continue
    }
  }
  
  isProcessingQueue = false;
}

// Activity tracking variables
let userActivityTimeout;
let messageInterval;
let isTabVisible = !document.hidden;
let isTabFocused = document.hasFocus();
let autoMessageCount = 0;
const MAX_AUTO_MESSAGES = 20;
const ACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity before stopping
const MESSAGE_INTERVAL = 2 * 60 * 1000; // 2 minutes between messages

// Cache for interface elements
// Wallet ID management
export async function getOrCreateWalletId() {
  try {
    // Try to get existing wallet ID from storage
    const result = await chrome.storage.local.get('walletId');
    if (result.walletId) {
      return result.walletId;
    }

    // Generate new wallet ID if none exists
    const array = new Uint8Array(12); // Use 12 bytes for more entropy
    crypto.getRandomValues(array);
    const walletId = Array.from(array, b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);

    // Store with current timestamp and other metadata
    const metadata = {
      walletId: walletId,
      createdAt: Date.now(),
      browserInfo: navigator.userAgent,
      installId: crypto.randomUUID() // Additional unique identifier
    };

    // Encrypt metadata before storing
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(metadata));
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, 
      true, 
      ['encrypt', 'decrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );

    // Store encrypted data
    await chrome.storage.local.set({
      walletId: walletId,
      walletData: {
        encrypted: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv)
      }
    });

    return walletId;
  } catch (error) {
    console.error('Error managing wallet ID:', error);
    return 'DEFAULT'; // Fallback
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
      const { timestamp } = result.rateLimitState;
      const now = Date.now();
      
      if (now - timestamp < RATE_LIMIT_RESET_INTERVAL) {
        // Still rate limited
        const input = interfaceElements.chatContainer.querySelector('.kinkong-chat-input');
        const sendButton = interfaceElements.chatContainer.querySelector('.kinkong-chat-send');
        
        if (input) {
          input.disabled = true;
          const remainingTime = getRemainingHoursText(result.rateLimitState.endTime);
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
        
        if (error.message === 'RATE_LIMIT_EXCEEDED') {
          // Set rate limit state
          await manageRateLimitState(true);
            
          // Create rate limit message element
          const rateLimitMessage = document.createElement('div');
          rateLimitMessage.className = 'kinkong-message bot rate-limit-message';
          const result = await chrome.storage.local.get('rateLimitState');
          const remainingTime = getRemainingHoursText(result.rateLimitState.endTime);
          
          rateLimitMessage.innerHTML = `
            <div style="margin-bottom: 10px;">
              ⚠️ You've reached your free message limit.
            </div>
            <div style="margin-bottom: 15px;">
              Your limit will reset in ${remainingTime}, or upgrade to Premium for:
              <ul style="margin-top: 8px; padding-left: 20px;">
                <li>Unlimited AI interactions</li>
                <li>Priority response time</li>
                <li>Advanced trading signals</li>
                <li>Portfolio tracking</li>
              </ul>
            </div>
            <a href="https://swarmtrade.ai/copilot" 
               target="_blank" 
               style="
                 display: inline-block;
                 background: linear-gradient(135deg, #ffd700, #ffa502);
                 color: #1a1a1a;
                 padding: 8px 16px;
                 border-radius: 6px;
                 text-decoration: none;
                 font-weight: 600;
                 transition: all 0.3s ease;
               "
               onmouseover="this.style.transform='translateY(-2px)'"
               onmouseout="this.style.transform='translateY(0)'">
              Upgrade to Premium
            </a>
          `;
            
          messagesContainer.appendChild(rateLimitMessage);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;

          // Disable input and update placeholder
          const input = chatContainer.querySelector('.kinkong-chat-input');
          input.disabled = true;
          input.placeholder = 'Chat will be re-enabled in 4 hours...';
            
          // Disable send button
          const sendButton = chatContainer.querySelector('.kinkong-chat-send');
          sendButton.disabled = true;
          sendButton.style.opacity = '0.5';
          
        } else {
          // Handle other errors as before
          addMessageToChatContainer(
            "Sorry, I'm having trouble connecting right now. Please try again later.",
            false
          );
        }
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
  // Only proceed if tab is visible and focused and we haven't hit the message limit
  if (!isTabVisible || !isTabFocused || autoMessageCount >= MAX_AUTO_MESSAGES) {
    if (messageInterval) {
      clearInterval(messageInterval);
      messageInterval = null;
    }
    return;
  }

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
      // Check message limit before sending
      if (autoMessageCount >= MAX_AUTO_MESSAGES) {
        clearInterval(messageInterval);
        messageInterval = null;
        addMessageToChatContainer(
          "I've reached my automatic message limit. Feel free to continue chatting with me directly!",
          false
        );
        return;
      }

      autoMessageCount++;
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
    }, MESSAGE_INTERVAL);
  }
}

function setupActivityTracking(shadow) {
  // Track tab visibility
  document.addEventListener('visibilitychange', () => {
    isTabVisible = !document.hidden;
    if (!isTabVisible && messageInterval) {
      clearInterval(messageInterval);
      messageInterval = null;
    } else if (isTabVisible && isTabFocused) {
      handleUserActivity();
    }
  });

  // Track window focus
  window.addEventListener('focus', () => {
    isTabFocused = true;
    if (isTabVisible) {
      handleUserActivity();
    }
  });

  window.addEventListener('blur', () => {
    isTabFocused = false;
    if (messageInterval) {
      clearInterval(messageInterval);
      messageInterval = null;
    }
  });

  // Track user activity
  const activityEvents = ['mousedown', 'keydown', 'mousemove', 'wheel', 'touchstart'];
  
  activityEvents.forEach(eventType => {
    shadow.addEventListener(eventType, handleUserActivity, { passive: true });
    document.addEventListener(eventType, handleUserActivity, { passive: true });
  });

  // Start tracking if tab is visible and focused
  if (isTabVisible && isTabFocused) {
    handleUserActivity();
  }

  // Clean up on page unload
  window.addEventListener('unload', () => {
    if (messageInterval) clearInterval(messageInterval);
    if (userActivityTimeout) clearTimeout(userActivityTimeout);
  });
}

export async function addMessageToChatContainer(message, isUser = true, shouldSave = true) {
  // Add to queue
  messageQueue.push({ message, isUser, shouldSave });
  
  // Start processing if not already running
  if (!isProcessingQueue) {
    processMessageQueue();
  }
}
