import { formatMessage } from '../chat/message-formatter.js';
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
      interfaceElements = await ensureChatInterface();
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
    
    // Create and add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = loadingId;
    loadingIndicator.className = 'typing-indicator';
    loadingIndicator.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    messagesContainer.appendChild(loadingIndicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const response = await makeApiCall('copilot', {
        message: initialMessage,
        url: window.location.href,
        pageContent: pageContent,
        pageType: pageType,
        fullyLoaded: elementsLoaded
      });

      // Add debug logging
      console.group('API Response Details');
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      const responseText = await response.text();
      console.log('Response text:', responseText);
      console.groupEnd();

      // Remove loading indicator properly
      const loadingElement = messagesContainer.querySelector(`#${loadingId}`);
      if (loadingElement) {
        loadingElement.remove();
      }

      // Check if response is empty or invalid
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from API');
      }

      // Remove any existing speech bubble
      const existingBubble = document.querySelector('.kinkong-speech-bubble');
      if (existingBubble) {
        existingBubble.remove();
      }

      // Create speech bubble
      const speechBubble = document.createElement('div');
      speechBubble.className = 'kinkong-speech-bubble';
      speechBubble.innerHTML = formatMessage(responseText);
      document.body.appendChild(speechBubble);

      // Auto-remove bubble after 8 seconds
      setTimeout(() => {
        speechBubble.classList.add('fade-out');
        setTimeout(() => {
          speechBubble.remove();
        }, 300);
      }, 8000);

      // Still add message to chat history
      addMessageToChatContainer(responseText, false);
      
    } catch (error) {
      console.error('API Error:', error);
      document.getElementById(loadingId)?.remove();
      
      // More descriptive error message
      const errorMessage = error.message === 'Empty response from API' 
        ? "I didn't receive a response from the server. Please try again."
        : "Sorry, I'm having trouble connecting right now. Please try again later.";
        
      addMessageToChatContainer(errorMessage, false);
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
