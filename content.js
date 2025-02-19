// Track when marked is loaded
let markedReady = false;

async function makeApiCall(endpoint, data) {
  // Log the request details
  console.group('API Request Details');
  console.log('Endpoint:', `https://swarmtrade.ai/api/${endpoint}`);
  console.log('Request Headers:', {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': window.location.origin
  });
  console.log('Request Body:', JSON.stringify(data, null, 2));
  console.groupEnd();

  try {
    // First check if we're online
    if (!navigator.onLine) {
      throw new Error('Browser is offline. Please check your internet connection.');
    }

    // Test the API endpoint with a preflight request
    try {
      const preflightResponse = await fetch(`https://swarmtrade.ai/api/${endpoint}`, {
        method: 'OPTIONS',
        mode: 'cors'
      });
      console.log('Preflight response:', preflightResponse);
    } catch (preflightError) {
      console.error('Preflight request failed:', preflightError);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`https://swarmtrade.ai/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': window.location.origin
      },
      credentials: 'include',
      mode: 'cors',
      signal: controller.signal,
      body: JSON.stringify(data)
    });

    clearTimeout(timeoutId);

    // Log the response details
    console.group('API Response Details');
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries([...response.headers]));
    if (!response.ok) {
      console.error('Response Error:', response.statusText);
    }
    console.groupEnd();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;

  } catch (error) {
    // Log error details
    console.group('API Error Details');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Request Data:', {
      endpoint,
      data,
      origin: window.location.origin,
      online: navigator.onLine,
      userAgent: navigator.userAgent
    });
    console.groupEnd();

    // Handle specific error cases
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds. Please try again.');
    }
    
    if (error.name === 'TypeError') {
      if (error.message.includes('Failed to fetch')) {
        if (!navigator.onLine) {
          throw new Error('You appear to be offline. Please check your internet connection.');
        } else {
          throw new Error('Unable to connect to SwarmTrade API. The service may be down or blocked by CORS policy.');
        }
      }
    }

    // If we get here, it's an unknown error
    throw new Error(`API call failed: ${error.message}`);
  }
}

function extractVisibleContent() {
  // If we're on dexscreener, get specific elements
  if (isDexScreenerTokenPage()) {
    const content = {
      url: window.location.href,
      pageContent: {
        // Get token info
        tokenName: document.querySelector('[data-cy="token-name"]')?.textContent?.trim(),
        tokenSymbol: document.querySelector('[data-cy="token-symbol"]')?.textContent?.trim(),
        price: document.querySelector('[data-cy="price"]')?.textContent?.trim(),
        // Get chart data if available
        marketCap: document.querySelector('[data-cy="market-cap"]')?.textContent?.trim(),
        liquidity: document.querySelector('[data-cy="liquidity"]')?.textContent?.trim(),
        volume: document.querySelector('[data-cy="volume"]')?.textContent?.trim(),
      }
    };
    
    // Filter out undefined/null values
    Object.keys(content.pageContent).forEach(key => {
      if (!content.pageContent[key]) {
        delete content.pageContent[key];
      }
    });

    return content;
  }

  // For other pages, keep the general text extraction
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.parentElement.offsetHeight === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.textContent.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        if (['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let content = '';
  let node;
  while (node = walker.nextNode()) {
    content += node.textContent.trim() + ' ';
  }

  return {
    url: window.location.href,
    pageContent: content.trim()
  };
}

// First inject the marked library
const markedScript = document.createElement('script');
markedScript.src = chrome.runtime.getURL('lib/marked.min.js');
document.head.appendChild(markedScript);

// Then create a bridge script to set up our formatter
const bridgeScript = document.createElement('script');
bridgeScript.src = chrome.runtime.getURL('lib/marked-bridge.js');
document.head.appendChild(bridgeScript);

markedScript.onload = () => {
  markedReady = true;
  // Dispatch event to notify the bridge script
  window.dispatchEvent(new Event('marked-ready'));
};

// Helper function for markdown formatting
function formatMessage(text) {
  if (markedReady && window.formatMarkdown) {
    try {
      return window.formatMarkdown(text);
    } catch (e) {
      console.error('Error formatting markdown:', e);
      return text;
    }
  }
  return text; // Fallback if marked isn't ready yet
}


function isDexScreenerTokenPage() {
  return window.location.hostname === 'dexscreener.com' && 
         window.location.pathname.split('/').length >= 3 && // Check if there's a chain and token address
         window.location.pathname !== '/'; // Exclude homepage
}

function ensureChatInterface() {
  if (!document.querySelector('.kinkong-chat-container')) {
    injectFloatingCopilot();
  }
  return {
    messagesContainer: document.querySelector('.kinkong-chat-messages'),
    chatContainer: document.querySelector('.kinkong-chat-container'),
    copilotImage: document.querySelector('.kinkong-floating-copilot')
  };
}

// Function to save messages
async function saveMessage(message, isUser) {
  const currentUrl = window.location.href;
  try {
    // Get existing messages for this URL
    const result = await chrome.storage.local.get('chatMessages');
    const urlMessages = result.chatMessages || {};
    
    // Initialize array for this URL if it doesn't exist
    if (!urlMessages[currentUrl]) {
      urlMessages[currentUrl] = [];
    }
    
    // Add new message
    urlMessages[currentUrl].push({
      content: message,
      isUser: isUser,
      timestamp: Date.now()
    });
    
    // Save back to storage
    await chrome.storage.local.set({ chatMessages: urlMessages });
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

// Function to load messages for current URL
async function loadMessages() {
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

// Function to display all messages
async function displayStoredMessages() {
  const messages = await loadMessages();
  const { messagesContainer } = ensureChatInterface();
  
  // Clear existing messages
  messagesContainer.innerHTML = '';
  
  // Display each message
  messages.forEach(message => {
    addMessageToChatContainer(message.content, message.isUser, false); // false means don't save again
  });
}

function addMessageToChatContainer(message, isUser = true, shouldSave = true) {
  const { messagesContainer, chatContainer, copilotImage } = ensureChatInterface();
  
  if (messagesContainer) {
    // If chat is closed, open it
    if (!chatContainer.classList.contains('visible')) {
      chatContainer.style.display = 'flex';
      // Wait a tiny bit for display:flex to take effect
      requestAnimationFrame(() => {
        chatContainer.classList.add('visible');
      });
      // Stop the floating animation when chat is open
      if (copilotImage) {
        copilotImage.style.animation = 'none';
      }
    }

    messagesContainer.innerHTML += `
      <div class="kinkong-message ${isUser ? 'user' : 'bot'}">
        ${formatMessage(message)}
      </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Save message if needed
    if (shouldSave) {
      saveMessage(message, isUser);
    }
  }
}


async function handleUrlChange() {
  if (isDexScreenerTokenPage()) {
    // Load and display any stored messages first
    await displayStoredMessages();
    
    const { messagesContainer } = ensureChatInterface();
    
    // Extract page content
    const pageContent = extractVisibleContent();
    
    // Add user message to chat
    addMessageToChatContainer('Opened this page, what do you think?', true);

    // Add loading indicator
    const loadingId = 'loading-' + Date.now();
    messagesContainer.innerHTML += `
      <div id="${loadingId}" class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      // Make API call to KinKong Copilot
      const response = await makeApiCall('copilot', {
        message: 'Opened this page, what do you think?',
        url: window.location.href,
        pageContent: pageContent
      });

      // Remove loading message
      document.getElementById(loadingId)?.remove();

      // Create response bubble
      const responseDiv = document.createElement('div');
      responseDiv.className = 'kinkong-message bot';
      messagesContainer.appendChild(responseDiv);

      // Get the response reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let responseText = '';

      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        
        // Decode and append new chunk
        const chunk = decoder.decode(value, {stream: true});
        responseText += chunk;
        
        // Update the response bubble with formatted text
        responseDiv.innerHTML = formatMessage(responseText);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      
      // Save the bot's response
      saveMessage(responseText, false);
      
    } catch (error) {
      console.error('API Error:', error);
      
      // Remove loading message
      document.getElementById(loadingId)?.remove();

      // Show error message
      const errorMessage = 'Sorry, I\'m having trouble connecting right now. Please try again later.';
      addMessageToChatContainer(errorMessage, false);
    }
  }
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
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE and Edge */
    }

    .kinkong-chat-messages::-webkit-scrollbar {
      display: none; /* Chrome, Safari, Opera */
    }

    .kinkong-message {
      margin-bottom: 10px;
      padding: 8px 12px;
      border-radius: 18px;
      max-width: 85%;
      transition: transform 0.2s ease;
      white-space: pre-wrap;
      word-wrap: break-word;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-size: 14px;
      line-height: 1.4;
      display: inline-block;
      width: auto;
    }

    .kinkong-message code {
      background: rgba(0,0,0,0.1);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 13px;
    }

    .kinkong-message pre {
      background: rgba(0,0,0,0.1);
      padding: 8px;
      border-radius: 5px;
      overflow-x: auto;
      font-size: 13px;
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
      margin-left: 12px; /* Add some left margin to align with bot messages */
    }

    .typing-dot {
      width: 6px;
      height: 6px;
      background: #ffd700; /* Change to gold color to match theme */
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
      // Extract visible content
      const pageContent = extractVisibleContent();
    
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
        <div id="${loadingId}" class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
      `;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      try {
        // Make API call to KinKong Copilot
        const response = await makeApiCall('copilot', {
          message: message,
          url: window.location.href,
          pageContent: pageContent
        });

        // Remove loading message
        document.getElementById(loadingId).remove();

        // Create response bubble
        const responseDiv = document.createElement('div');
        responseDiv.className = 'kinkong-message bot';
        messagesContainer.appendChild(responseDiv);

        // Get the response reader
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = '';

        while (true) {
          const {value, done} = await reader.read();
          if (done) break;
          
          // Decode and append new chunk
          const chunk = decoder.decode(value, {stream: true});
          responseText += chunk;
          
          // Update the response bubble with formatted text
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

// Initialize chat interface
ensureChatInterface();

// Listen for URL changes
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    handleUrlChange();
  }
}).observe(document, {subtree: true, childList: true});

// Also check when the script first loads
handleUrlChange();
