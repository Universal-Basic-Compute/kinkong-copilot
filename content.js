// Track when marked is loaded
let markedReady = false;

async function makeApiCall(endpoint, data) {
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
    if (!navigator.onLine) {
      throw new Error('Browser is offline. Please check your internet connection.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // Try with regular CORS first
    try {
      const response = await fetch(`https://swarmtrade.ai/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain, application/json'
        },
        mode: 'cors',
        signal: controller.signal,
        body: JSON.stringify(data)
      });

      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
    } catch (corsError) {
      console.log('CORS request failed, falling back to extension background proxy');
      
      // Send message to background script to make the request
      const proxyResponse = await chrome.runtime.sendMessage({
        type: 'proxyRequest',
        endpoint: `https://swarmtrade.ai/api/${endpoint}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain, application/json'
        },
        body: data
      });

      if (proxyResponse.error) {
        throw new Error(proxyResponse.error);
      }

      return new Response(proxyResponse.data, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

  } catch (error) {
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

    throw new Error('Unable to connect to SwarmTrade API. The service may be down or blocked by CORS policy.');
  }
}

// Helper function to find content using multiple selectors and text matching
function findContent(selectors) {
  for (const selector of selectors) {
    // Handle special case for text content matching
    if (selector.includes(':contains(')) {
      const basicSelector = selector.split(':contains(')[0];
      const searchText = selector.match(/contains\("(.+)"\)/)[1];
      
      // Find elements matching basic selector
      const elements = document.querySelectorAll(basicSelector);
      for (const element of elements) {
        if (element.textContent.includes(searchText)) {
          return element.textContent.trim();
        }
      }
      continue;
    }

    // Regular selector
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent.trim();
      if (text) return text;
    }
  }
  return '';
}

function extractVisibleContent() {
  if (isDexScreenerTokenPage()) {
    // Get all text content from the main container
    const mainContent = document.querySelector('#__next') || document.querySelector('#root');
    let textContent = '';
    
    if (mainContent) {
      // Get all visible text nodes
      const textNodes = [];
      const walker = document.createTreeWalker(
        mainContent,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            // Check if the node's parent is visible
            const style = window.getComputedStyle(node.parentElement);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
            // Ignore script and style tags
            if (['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      while (walker.nextNode()) {
        const text = walker.currentNode.textContent.trim();
        if (text) {
          textNodes.push(text);
        }
      }
      
      textContent = textNodes.join(' ');
    }

    const content = {
      url: window.location.href,
      pageContent: {
        // Get all visible text
        fullText: textContent,
        
        // Try multiple selectors for token info
        tokenName: findContent([
          '[data-cy="token-name"]',
          'h1',
          '[role="heading"]',
          '.chakra-text'
        ]),
        
        tokenSymbol: findContent([
          '[data-cy="token-symbol"]',
          'h2',
          '.chakra-text'
        ]),
        
        price: findContent([
          '[data-cy="price"]',
          '[role="heading"]'
        ]),
        
        // Get any numbers that look like prices
        possiblePrices: findPrices(textContent)
      }
    };

    // Remove empty values
    Object.keys(content.pageContent).forEach(key => {
      if (!content.pageContent[key] || 
          content.pageContent[key] === 'Loading...' ||
          content.pageContent[key] === '' ||
          (Array.isArray(content.pageContent[key]) && content.pageContent[key].length === 0)) {
        delete content.pageContent[key];
      }
    });

    console.log('Extracted content:', content);
    return content;
  }
  
  return {
    url: window.location.href,
    pageContent: {}
  };
}

// Helper function to find content using multiple selectors
function findContent(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent.trim();
      if (text) return text;
    }
  }
  return '';
}

// Helper function to find price-like numbers in text
function findPrices(text) {
  const priceRegex = /\$\s*\d+(?:[.,]\d+)?/g;
  const matches = text.match(priceRegex);
  return matches || [];
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
  const isDex = window.location.hostname === 'dexscreener.com';
  const hasPath = window.location.pathname.split('/').length >= 3;
  const notHome = window.location.pathname !== '/';
  
  console.log('DexScreener check:', {
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    isDex,
    hasPath,
    notHome,
    result: isDex && hasPath && notHome
  });
  
  return isDex && hasPath && notHome;
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


// Function to wait for DexScreener elements to be loaded
async function waitForDexScreenerElements() {
  const maxWaitTime = 5000; // 5 seconds maximum wait
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    console.log(`Checking elements... Time elapsed: ${Date.now() - startTime}ms`);
    
    // Check for key elements
    const tokenName = document.querySelector('[data-cy="token-name"]');
    const tokenSymbol = document.querySelector('[data-cy="token-symbol"]');
    const price = document.querySelector('[data-cy="price"]');
    
    if (tokenName && tokenSymbol && price) {
      console.log('Found all DexScreener elements');
      return true;
    }
    
    // Wait 500ms before next check
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('Timeout reached, proceeding with partial content');
  return false;
}

async function handleUrlChange() {
  console.log('handleUrlChange called');
  
  if (isDexScreenerTokenPage()) {
    console.log('Is DexScreener page, waiting for elements...');
    
    // Load and display any stored messages first
    await displayStoredMessages();
    
    // Wait for page elements to load (but proceed after 5 seconds regardless)
    const elementsLoaded = await waitForDexScreenerElements();
    console.log('Elements loaded status:', elementsLoaded);
    
    const { messagesContainer } = ensureChatInterface();
    console.log('Chat interface ready:', !!messagesContainer);
    
    // Extract page content
    const pageContent = extractVisibleContent();
    console.log('Page content extracted:', pageContent);
    
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
        pageContent: pageContent,
        fullyLoaded: elementsLoaded
      });

      // Remove loading message
      document.getElementById(loadingId)?.remove();

      // Create response bubble
      const responseDiv = document.createElement('div');
      responseDiv.className = 'kinkong-message bot';
      messagesContainer.appendChild(responseDiv);

      // Get the response as text
      const responseText = await response.text();
      
      // Update the response bubble with formatted text
      responseDiv.innerHTML = formatMessage(responseText);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
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

// Initialize chat interface immediately
ensureChatInterface();

// Listen for URL changes using both methods for better coverage
let lastUrl = location.href; 

// Method 1: MutationObserver for dynamic changes
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    console.log('URL changed to:', url);
    lastUrl = url;
    handleUrlChange();
  }
}).observe(document, {subtree: true, childList: true});

// Method 2: Direct check on page load
console.log('Initial URL check:', window.location.href);
if (isDexScreenerTokenPage()) {
  console.log('Initial page is DexScreener token page');
  handleUrlChange();
}
