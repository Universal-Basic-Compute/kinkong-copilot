import { isSupportedPage } from './content/page-detector.js';
import { handleUrlChange } from './handlers/url-handler.js';

let urlObserver = null;

// Initialize only URL observer
export async function initialize() {
  setupUrlObserver();
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
    if (copilotEnabled && isSupportedPage()) {
      await handleUrlChange();
    }
  } catch (error) {
    console.error('Error handling URL change:', error);
  }
}

