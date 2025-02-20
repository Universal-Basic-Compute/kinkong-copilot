import { ensureChatInterface, addMessageToChatContainer } from './src/chat/chat-interface.js';
import { findContent } from './src/utils/dom-utils.js';
import { extractXContent } from './src/content/content-extractor.js';
import { isXPage, isSupportedPage } from './src/content/page-detector.js';

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
