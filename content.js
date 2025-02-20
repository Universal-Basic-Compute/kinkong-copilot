import { ensureChatInterface, addMessageToChatContainer } from './src/chat/chat-interface.js';

// Track when marked is loaded
let markedReady = false;
let copilotEnabled = true;

// Add message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'updateCopilotState') {
    copilotEnabled = message.enabled;
    const copilotImage = document.querySelector('.kinkong-floating-copilot');
    const chatContainer = document.querySelector('.kinkong-chat-container');
    
    if (copilotImage) {
      copilotImage.style.display = message.enabled ? 'block' : 'none';
    }
    if (chatContainer) {
      chatContainer.style.display = 'none';
      chatContainer.classList.remove('visible');
    }
  }
});

// Initialize copilot state
document.addEventListener('DOMContentLoaded', async () => {
  chrome.storage.sync.get({
    copilotEnabled: true
  }, (items) => {
    copilotEnabled = items.copilotEnabled;
    const copilotImage = document.querySelector('.kinkong-floating-copilot');
    if (copilotImage) {
      copilotImage.style.display = copilotEnabled ? 'block' : 'none';
    }
  });
});

// Suppress ResizeObserver errors
const consoleError = console.error;
console.error = function(...args) {
  if (args[0]?.includes?.('ResizeObserver')) return;
  consoleError.apply(console, args);
};


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
  // Get main content elements in order of likely relevance
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '#content',
    '.content',
    '.main-content',
    'body'
  ];

  let mainContent = null;
  for (const selector of mainSelectors) {
    mainContent = document.querySelector(selector);
    if (mainContent) break;
  }

  // Fallback to body if no main content found
  mainContent = mainContent || document.body;

  // Get all visible text nodes, excluding our chat interface
  const textNodes = [];
  const walker = document.createTreeWalker(
    mainContent,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip if parent is hidden
        const style = window.getComputedStyle(node.parentElement);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip our own chat interface elements
        if (node.parentElement.closest('.kinkong-chat-container') || 
            node.parentElement.closest('.kinkong-floating-copilot') ||
            node.parentElement.closest('.kinkong-message')) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip script, style, and other non-content tags
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(node.parentElement.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip empty text nodes and whitespace
        const text = node.textContent.trim();
        if (!text) {
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

  // Get page title and meta description
  const title = document.title || '';
  const description = document.querySelector('meta[name="description"]')?.content || '';

  // Create content object
  const content = {
    url: window.location.href,
    pageContent: {
      title: title,
      description: description,
      mainContent: textNodes.join(' ').trim()
    }
  };

  // Remove empty values
  Object.keys(content.pageContent).forEach(key => {
    if (!content.pageContent[key]) {
      delete content.pageContent[key];
    }
  });

  console.log('Extracted content:', content);
  return content;
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


async function waitForXContent() {
  const maxWaitTime = 5000; // 5 seconds maximum wait
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    // Check for main timeline or profile content
    const timeline = document.querySelector('[data-testid="primaryColumn"]');
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    const profileInfo = document.querySelector('[data-testid="UserName"]');
    
    if ((timeline && tweets.length > 0) || profileInfo) {
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false;
}

function extractXContent() {
  const content = {
    url: window.location.href,
    pageContent: {}
  };

  try {
    // Get profile info if on profile page
    const profileName = document.querySelector('[data-testid="UserName"]')?.textContent;
    const profileBio = document.querySelector('[data-testid="UserDescription"]')?.textContent;
    const profileLocation = document.querySelector('[data-testid="UserLocation"]')?.textContent;
    
    if (profileName) {
      content.pageContent.profile = {
        name: profileName,
        bio: profileBio,
        location: profileLocation
      };
    }

    // Get tweets
    const tweets = Array.from(document.querySelectorAll('[data-testid="tweet"]'));
    if (tweets.length > 0) {
      content.pageContent.tweets = tweets.map(tweet => ({
        text: tweet.querySelector('[data-testid="tweetText"]')?.textContent,
        time: tweet.querySelector('time')?.getAttribute('datetime'),
        engagement: {
          replies: tweet.querySelector('[data-testid="reply"]')?.textContent,
          retweets: tweet.querySelector('[data-testid="retweet"]')?.textContent,
          likes: tweet.querySelector('[data-testid="like"]')?.textContent
        }
      })).filter(tweet => tweet.text); // Only include tweets with text content
    }

    // If no specific content found, get general page content
    if (!content.pageContent.profile && !content.pageContent.tweets) {
      content.pageContent.mainContent = document.querySelector('[data-testid="primaryColumn"]')?.textContent;
    }

  } catch (error) {
    console.error('Error extracting X content:', error);
    // Fallback to basic content
    content.pageContent.mainContent = document.body.textContent;
  }

  return content;
}

function isXPage() {
  const hostname = window.location.hostname;
  return hostname === 'x.com' || hostname === 'twitter.com';
}

function isSwarmTradePage() {
  const hostname = window.location.hostname;
  return hostname === 'swarmtrade.ai';
}

function isUBCPage() {
  const hostname = window.location.hostname;
  return hostname === 'universalbasiccompute.ai';
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

function isSolscanPage() {
  const hostname = window.location.hostname;
  return hostname === 'solscan.io';
}

function isSupportedPage() {
  // Check URL and return appropriate type
  if (isDexScreenerTokenPage()) {
    return 'dexscreener';
  } else if (isXPage()) {
    return 'x';
  } else if (isSolscanPage()) {
    return 'solscan';
  } else if (isSwarmTradePage()) {
    return 'swarmtrade';
  } else if (isUBCPage()) {
    return 'ubc';
  }
  return null;
}

function getInitialMessage(pageType) {
  const path = window.location.pathname;
  const cleanPath = path === '/' ? 'home' : path.replace(/^\/+|\/+$/g, '');
  
  return `I'm on ${cleanPath}, what do you think?`;
}

function ensureChatInterface() {
  // Check if interface already exists
  const existing = {
    messagesContainer: document.querySelector('.kinkong-chat-messages'),
    chatContainer: document.querySelector('.kinkong-chat-container'),
    copilotImage: document.querySelector('.kinkong-floating-copilot')
  };

  if (existing.messagesContainer && existing.chatContainer && existing.copilotImage) {
    return existing;
  }

  // If not exists, create it
  try {
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
    }
    
    // Stop the floating animation when chat is open
    if (copilotImage) {
      copilotImage.style.animation = 'none';
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
  try {
    if (!copilotEnabled) {
      console.log('Copilot disabled, skipping');
      return;
    }
    console.log('handleUrlChange called');
    
    const pageType = isSupportedPage();
    if (!pageType) return;

    console.log('On supported page:', pageType);
    
    // Ensure chat interface exists before proceeding
    let interfaceElements;
    try {
      interfaceElements = ensureChatInterface();
      if (!interfaceElements.messagesContainer) {
        throw new Error('Messages container not found');
      }
    } catch (error) {
      console.error('Failed to create chat interface:', error);
      return; // Exit gracefully instead of throwing
    }

    // Load stored messages
    await displayStoredMessages().catch(err => {
      console.warn('Failed to load stored messages:', err);
    });
    
    // Wait for content based on page type
    let elementsLoaded = false;
    if (pageType === 'dexscreener') {
      elementsLoaded = await waitForDexScreenerElements();
    } else if (pageType === 'x') {
      elementsLoaded = await waitForXContent();
    } else {
      elementsLoaded = true;
    }
    
    console.log('Elements loaded status:', elementsLoaded);
    
    // Extract content using appropriate method
    const pageContent = pageType === 'x' ? 
      extractXContent() : 
      extractVisibleContent();
    if (!pageContent) {
      throw new Error('Failed to extract page content');
    }

    // Get appropriate initial message based on page type
    const initialMessage = getInitialMessage(pageType);
    
    // Add user message to chat
    addMessageToChatContainer(initialMessage, true);

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
        message: initialMessage,
        url: window.location.href,
        pageContent: pageContent,
        pageType: pageType,
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
  } catch (error) {
    console.error('Error in handleUrlChange:', error);
    
    // Show error in chat if possible
    try {
      const { messagesContainer } = ensureChatInterface();
      if (messagesContainer) {
        addMessageToChatContainer(
          'Sorry, something went wrong. Please try refreshing the page.',
          false
        );
      }
    } catch (e) {
      console.error('Failed to show error message:', e);
    }
  }
}


function waitForDOM() {
  return new Promise(resolve => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      resolve();
    }
  });
}

// Initialize chat interface
async function initialize() {
  try {
    // Wait for DOM to be ready
    await waitForDOM();
    
    // Load saved preferences
    const { copilotEnabled } = await chrome.storage.sync.get({ copilotEnabled: true });
    
    // Create interface if enabled
    if (copilotEnabled) {
      await injectFloatingCopilot();
      console.log('Chat interface created successfully');
      
      // Check initial page
      const initialPageType = isSupportedPage();
      if (initialPageType) {
        console.log('Initial page is supported:', initialPageType);
        await handleUrlChange();
      }
    }
  } catch (error) {
    console.error('Error during initialization:', error);
  }
}

// Start initialization
initialize();

// Listen for URL changes
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    console.log('URL changed to:', url);
    lastUrl = url;
    if (copilotEnabled) {
      handleUrlChange().catch(error => {
        console.error('Error handling URL change:', error);
      });
    }
  }
}).observe(document, {subtree: true, childList: true});
// Add Phantom wallet bridge
window.addEventListener('message', async (event) => {
  // Only accept messages from our extension
  if (event.source !== window) return;
  
  if (event.data.type === 'PHANTOM_CONNECT_REQUEST') {
    try {
      const provider = window?.solana;
      if (!provider?.isPhantom) {
        window.postMessage({ 
          type: 'PHANTOM_CONNECT_RESPONSE',
          error: 'Phantom not installed'
        }, '*');
        return;
      }

      const resp = await provider.connect();
      window.postMessage({ 
        type: 'PHANTOM_CONNECT_RESPONSE',
        publicKey: resp.publicKey.toString()
      }, '*');
    } catch (error) {
      window.postMessage({ 
        type: 'PHANTOM_CONNECT_RESPONSE',
        error: error.message
      }, '*');
    }
  }
});
