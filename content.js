const base = chrome.runtime.getURL('');

import { ensureChatInterface, addMessageToChatContainer } from `${base}src/chat/chat-interface.js`;
import { findContent } from `${base}src/utils/dom-utils.js`;
import { extractXContent } from `${base}src/content/content-extractor.js`;
import { isXPage, isSupportedPage } from `${base}src/content/page-detector.js`;

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
