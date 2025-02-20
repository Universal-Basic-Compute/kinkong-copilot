import { waitForDOM } from './utils/dom-utils.js';
import { isSupportedPage } from './content/page-detector.js';
import { injectFloatingCopilot } from './chat/chat-interface.js';
import { handleUrlChange } from './handlers/url-handler.js';

// Initialize chat interface
export async function initialize() {
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
  } catch (error) {
    console.error('Error during initialization:', error);
  }
}

// Listen for URL changes
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    console.log('URL changed to:', url);
    lastUrl = url;
    chrome.storage.sync.get({ copilotEnabled: true }, (items) => {
      if (items.copilotEnabled) {
        handleUrlChange().catch(error => {
          console.error('Error handling URL change:', error);
        });
      }
    });
  }
}).observe(document, {subtree: true, childList: true});

// Export initialize but don't call it directly
export { initialize };
