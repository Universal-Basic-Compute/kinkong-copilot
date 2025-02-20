import { isSupportedPage } from '../content/page-detector.js';
import { ensureChatInterface, addMessageToChatContainer } from '../chat/chat-interface.js';
import { displayStoredMessages } from '../chat/chat-storage.js';
import { waitForDexScreenerElements, waitForXContent } from '../utils/dom-utils.js';
import { extractVisibleContent, extractXContent } from '../content/content-extractor.js';
import { makeApiCall } from '../api/api-client.js';

export async function handleUrlChange() {
  try {
    const pageType = isSupportedPage();
    if (!pageType) return;

    console.log('On supported page:', pageType);
    
    let interfaceElements;
    try {
      interfaceElements = ensureChatInterface();
      if (!interfaceElements.messagesContainer) {
        throw new Error('Messages container not found');
      }
    } catch (error) {
      console.error('Failed to create chat interface:', error);
      return;
    }

    // Destructure messagesContainer from interfaceElements
    const { messagesContainer } = interfaceElements;

    await displayStoredMessages().catch(err => {
      console.warn('Failed to load stored messages:', err);
    });
    
    // Wait 5 seconds silently before proceeding
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    let elementsLoaded = false;
    if (pageType === 'dexscreener') {
      elementsLoaded = await waitForDexScreenerElements();
    } else if (pageType === 'x') {
      elementsLoaded = await waitForXContent();
    } else {
      elementsLoaded = true;
    }
    
    const pageContent = pageType === 'x' ? extractXContent() : extractVisibleContent();
    if (!pageContent) {
      throw new Error('Failed to extract page content');
    }

    const initialMessage = getInitialMessage(pageType);
    addMessageToChatContainer(initialMessage, true);

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
      const response = await makeApiCall('copilot', {
        message: initialMessage,
        url: window.location.href,
        pageContent: pageContent,
        pageType: pageType,
        fullyLoaded: elementsLoaded
      });

      document.getElementById(loadingId)?.remove();

      const responseText = await response.text();
      addMessageToChatContainer(responseText, false);
      
    } catch (error) {
      console.error('API Error:', error);
      document.getElementById(loadingId)?.remove();
      addMessageToChatContainer(
        'Sorry, I\'m having trouble connecting right now. Please try again later.',
        false
      );
    }
  } catch (error) {
    console.error('Error in handleUrlChange:', error);
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

function getInitialMessage(pageType) {
  const path = window.location.pathname;
  const cleanPath = path === '/' ? 'home' : path.replace(/^\/+|\/+$/g, '');
  return `I'm on ${cleanPath}, what do you think?`;
}
