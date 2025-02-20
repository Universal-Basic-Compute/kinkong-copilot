import { waitForDOM } from './utils/dom-utils.js';
import { isSupportedPage } from './content/page-detector.js';
import { injectFloatingCopilot } from './chat/chat-interface.js';
import { handleUrlChange } from './handlers/url-handler.js';

const INIT_FLAG = 'kinkong-initialized';

// Initialize chat interface
export async function initialize() {
  // Check if already initialized
  if (window[INIT_FLAG]) {
    console.warn('KinKong already initialized');
    return;
  }
  
  try {
    await waitForDOM();
    
    const { copilotEnabled } = await chrome.storage.sync.get({ copilotEnabled: true });
    
    if (copilotEnabled) {
      await injectFloatingCopilot();
      console.log('Chat interface created successfully');
      
      const initialPageType = isSupportedPage();
      if (initialPageType) {
        console.log('Initial page is supported:', initialPageType);
        await handleUrlChange();
      }
    }

    // Mark as initialized
    window[INIT_FLAG] = true;
    
    // Set up URL change listener
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        console.log('URL changed to:', url);
        lastUrl = url;
        handleUrlChangeIfEnabled();
      }
    }).observe(document, {subtree: true, childList: true});

  } catch (error) {
    console.error('Error during initialization:', error);
  }
}

async function handleUrlChangeIfEnabled() {
  try {
    const { copilotEnabled } = await chrome.storage.sync.get({ copilotEnabled: true });
    if (copilotEnabled && isSupportedPage()) {
      await handleUrlChange();
    }
  } catch (error) {
    console.error('Error handling URL change:', error);
  }
}

