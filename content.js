const base = chrome.runtime.getURL('');
let modules;
window.currentPageContent = null;
let urlObserver = null;
let phantomInjectionAttempts = 0;
const MAX_PHANTOM_ATTEMPTS = 10;
let processedSignalIds = new Set();

// Helper function to check if extension context is valid
function isExtensionContextValid() {
  try {
    // This will throw an error if the extension context is invalid
    chrome.runtime.getURL('');
    return true;
  } catch (e) {
    console.warn('Extension context invalid:', e);
    return false;
  }
}

// Add SSE message handler
chrome.runtime.onMessage.addListener((message) => {
  // Check context validity first
  if (!isExtensionContextValid()) {
    return;
  }
  
  if (message.type === 'SERVER_PUSH') {
    // Initialize modules first if needed
    if (!modules) {
      initializeModules().then(loadedModules => {
        modules = loadedModules;
        handleContentPush(message.data);
      }).catch(error => {
        console.error('Failed to initialize modules for SERVER_PUSH:', error);
      });
    } else {
      handleContentPush(message.data);
    }
  }
  if (message.type === 'showKinKongIfInactive') {
    console.log('Received showKinKongIfInactive message', message);
    // Store the page content globally
    window.currentPageContent = message.pageContent;
    
    initializeModules().then(loadedModules => {
      modules = loadedModules;
      modules.chatInterface.ensureChatInterface().then(elements => {
        if (elements && elements.copilotImage) {
          console.log('Showing KinKong copilot image');
          elements.copilotImage.style.display = 'block';
        } else {
          console.error('Could not find copilot image element');
        }
      }).catch(err => {
        console.error('Error ensuring chat interface:', err);
      });
    }).catch(error => {
      console.error('Failed to initialize modules:', error);
    });
  }
});

async function handleContentPush(data) {
  try {
    console.log('[Content] Received push data:', JSON.stringify(data));
    
    // Check if modules are initialized
    if (!modules) {
      console.log('[Content] Modules not initialized yet, initializing now...');
      modules = await initializeModules();
      console.log('[Content] Modules initialized successfully');
    }
    
    // Ensure chat interface is available
    console.log('[Content] Ensuring chat interface is available');
    const elements = await modules.chatInterface.ensureChatInterface();
    console.log('[Content] Chat interface ready:', elements ? 'Yes' : 'No');
    
    switch(data.type) {
      case 'PRICE_ALERT':
        console.log('[Content] Processing price alert');
        // Show price alert in chat
        const alertMessage = formatPriceAlert(data.alert);
        console.log('[Content] Adding price alert to chat:', alertMessage);
        await modules.chatInterface.addMessageToChatContainer(alertMessage, false);
        console.log('[Content] Price alert added to chat');
        break;
        
      default:
        console.log(`[Content] Unknown push data type: ${data.type}`);
    }
  } catch (error) {
    console.error('[Content] Error handling pushed message:', error);
  }
}

function formatPriceAlert(alert) {
  return `💰 Price Alert
${alert.token} has ${alert.direction === 'up' ? 'reached' : 'dropped to'} $${alert.price}
Change: ${alert.changePercent}%`;
}

async function waitForPhantom() {
  while (phantomInjectionAttempts < MAX_PHANTOM_ATTEMPTS) {
    if (window?.solana?.isPhantom) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    phantomInjectionAttempts++;
  }
  return false;
}

async function initializeModules() {
  if (window.kinkongModules) {
    return window.kinkongModules;
  }
  
  console.group('Module Initialization');
  console.log('Starting initialization...');
  try {
    // Import all required modules dynamically with explicit paths
    const modules = {
      chatInterface: await import(base + 'src/chat/chat-interface.js'),
      domUtils: await import(base + 'src/utils/dom-utils.js'),
      contentExtractor: await import(base + 'src/content/content-extractor.js'),
      pageDetector: await import(base + 'src/content/page-detector.js'),
      urlHandler: await import(base + 'src/handlers/url-handler.js')
    };
    
    window.kinkongModules = modules;
    console.log('All modules loaded successfully');
    return modules;
  } catch (error) {
    console.error('Error loading modules:', error);
    throw error;
  }
}

function setupUrlObserver() {
  // Remove existing observer if any
  if (urlObserver) {
    urlObserver.disconnect();
  }

  let lastUrl = location.href;
  urlObserver = new MutationObserver(() => {
    // First check if extension context is still valid
    if (!isExtensionContextValid()) {
      console.log('Extension context invalid, disconnecting observer');
      urlObserver.disconnect();
      return;
    }
    
    const url = location.href;
    if (url !== lastUrl) {
      console.log('URL changed to:', url);
      lastUrl = url;
      handleUrlChangeIfEnabled();
    }
  });
  
  urlObserver.observe(document, {subtree: true, childList: true});
}

async function handleUrlChangeIfEnabled() {
  try {
    // Check extension context before proceeding
    if (!isExtensionContextValid()) {
      console.log('Extension context invalid, skipping URL change handling');
      return;
    }
    
    const { copilotEnabled } = await chrome.storage.sync.get({ copilotEnabled: true });
    if (copilotEnabled && modules && await modules.pageDetector.isSupportedPage()) {
      await modules.urlHandler.handleUrlChange();
    }
  } catch (error) {
    console.error('Error handling URL change:', error);
  }
}

// Initialize once
initializeModules().then(loadedModules => {
  modules = loadedModules;
  setupUrlObserver();
  
  // Initial URL check
  handleUrlChangeIfEnabled().catch(error => {
    console.error('Error during initial URL check:', error);
  });
}).catch(error => {
  console.error('Failed to initialize modules:', error);
});

// Initialize copilot state 
let copilotEnabled = true;

// Add message listener 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check context validity first
  if (!isExtensionContextValid()) {
    return;
  }
  
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
  
  if (message.type === 'updateVoiceState') {
    // Store the voice state
    chrome.storage.sync.set({ voiceEnabled: message.enabled });
    console.log(`Voice ${message.enabled ? 'enabled' : 'disabled'}`);
  }
  
  if (message.type === 'PHANTOM_CONNECT_REQUEST') {
    // Forward the request to the page through our existing bridge
    window.postMessage({ type: 'PHANTOM_CONNECT_REQUEST' }, '*');
    
    // Set up one-time listener for the response
    const messageHandler = (event) => {
      if (event.data.type === 'PHANTOM_CONNECT_RESPONSE') {
        window.removeEventListener('message', messageHandler);
        sendResponse(event.data);
      }
    };
    
    window.addEventListener('message', messageHandler);
    return true; // Will respond asynchronously
  }
});

// Suppress ResizeObserver errors
const consoleError = console.error;
console.error = function(...args) {
  if (args[0]?.includes?.('ResizeObserver')) return;
  consoleError.apply(console, args);
};

// Add Phantom wallet bridge
window.addEventListener('message', async (event) => {
  // Only accept messages from our extension
  if (event.source !== window) return;
  
  if (event.data.type === 'PHANTOM_CONNECT_REQUEST') {
    try {
      // Check if Phantom is installed
      if (!window.solana || !window.solana.isPhantom) {
        window.postMessage({ 
          type: 'PHANTOM_CONNECT_RESPONSE',
          error: 'Phantom not installed'
        }, '*');
        return;
      }

      // Check if already connected
      try {
        const resp = await window.solana.connect({ onlyIfTrusted: true });
        window.postMessage({ 
          type: 'PHANTOM_CONNECT_RESPONSE',
          publicKey: resp.publicKey.toString()
        }, '*');
        return;
      } catch (e) {
        // Not already connected, proceed with connect request
      }

      // Request new connection
      try {
        const resp = await window.solana.connect();
        window.postMessage({ 
          type: 'PHANTOM_CONNECT_RESPONSE',
          publicKey: resp.publicKey.toString()
        }, '*');
      } catch (error) {
        // Handle user rejection or other errors
        window.postMessage({ 
          type: 'PHANTOM_CONNECT_RESPONSE',
          error: error.message || 'User rejected the request'
        }, '*');
      }

    } catch (error) {
      window.postMessage({ 
        type: 'PHANTOM_CONNECT_RESPONSE',
        error: 'Unexpected error connecting to Phantom'
      }, '*');
    }
  }
});
