const base = chrome.runtime.getURL('');
let modules;
let urlObserver = null;

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
    const { copilotEnabled } = await chrome.storage.sync.get({ copilotEnabled: true });
    if (copilotEnabled && modules.pageDetector.isSupportedPage()) {
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
