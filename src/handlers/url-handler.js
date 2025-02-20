import { formatMessage } from '../chat/message-formatter.js';
import { isSupportedPage } from '../content/page-detector.js';
import { ensureChatInterface, addMessageToChatContainer } from '../chat/chat-interface.js';
import { displayStoredMessages } from '../chat/chat-storage.js';
import { waitForDexScreenerElements, waitForXContent } from '../utils/dom-utils.js';
import { extractVisibleContent, extractXContent } from '../content/content-extractor.js';
import { makeApiCall } from '../api/api-client.js';

let lastApiCallUrl = null;

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
    
    // Only make API call if URL hasn't changed during wait
    const currentUrl = window.location.href;
    if (currentUrl === lastApiCallUrl) {
      console.log('Skipping duplicate API call for:', currentUrl);
      return;
    }
    
    // Mark this URL as having an API call in progress
    lastApiCallUrl = currentUrl;
    
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
        url: currentUrl,  // Use URL from when API call was initiated
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

      // Get the shadow root
      const shadowContainer = document.getElementById('kinkong-shadow-container');
      if (!shadowContainer || !shadowContainer.shadowRoot) {
        throw new Error('Shadow container not found');
      }
      const shadow = shadowContainer.shadowRoot;

      // Add full message to chat history first
      addMessageToChatContainer(responseText, false);

      // Show paragraphs one by one in bubbles
      await showMessageParagraphs(responseText, shadow);
      
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

function getReadingTime(text) {
  // Slower reading speed: 120 words per minute, or about 10 chars per second
  const charsPerSecond = 10;
  
  // Minimum 2 seconds, maximum 6 seconds per paragraph
  return Math.max(2000, Math.min(6000, (text.length / charsPerSecond) * 1000));
}

export async function showMessageParagraphs(responseText, shadow) {
  // Split message into paragraphs (split by double newline or markdown headers)
  const paragraphs = responseText.split(/\n\n|(?=#{1,6}\s)/g)
    .filter(p => p.trim().length > 0);
    
  console.log('Showing bubbles for paragraphs:', paragraphs.length);
  
  for (const paragraph of paragraphs) {
    // Remove any existing speech bubble
    const existingBubble = shadow.querySelector('.kinkong-speech-bubble');
    if (existingBubble) {
      existingBubble.remove();
    }

    // Create new speech bubble
    const speechBubble = document.createElement('div');
    speechBubble.className = 'kinkong-speech-bubble';
    speechBubble.innerHTML = formatMessage(paragraph);
    shadow.appendChild(speechBubble);

    // Add click handler
    speechBubble.addEventListener('click', () => {
      speechBubble.remove();
      const chatContainer = shadow.querySelector('.kinkong-chat-container');
      if (chatContainer) {
        chatContainer.style.display = 'flex';
        requestAnimationFrame(() => {
          chatContainer.classList.add('visible');
          const messagesContainer = chatContainer.querySelector('.kinkong-chat-messages');
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        });
      }
      
      const copilotImage = shadow.querySelector('.kinkong-floating-copilot');
      if (copilotImage) {
        copilotImage.style.animation = 'none';
      }
    });

    // Wait for reading time before showing next paragraph
    const readingTime = getReadingTime(paragraph);
    await new Promise(resolve => setTimeout(resolve, readingTime));
  }

  // Remove last bubble after reading time
  const lastBubble = shadow.querySelector('.kinkong-speech-bubble');
  if (lastBubble) {
    // Calculate reading time for the last paragraph
    const lastParagraph = paragraphs[paragraphs.length - 1];
    const lastReadingTime = getReadingTime(lastParagraph);
    
    setTimeout(() => {
      if (shadow.contains(lastBubble)) {
        lastBubble.classList.add('fade-out');
        setTimeout(() => {
          if (shadow.contains(lastBubble)) {
            lastBubble.remove();
          }
        }, 300);
      }
    }, lastReadingTime); // Use calculated reading time instead of hardcoded 8000
  }
}

function getInitialMessage(pageType) {
  const path = window.location.pathname;
  const cleanPath = path === '/' ? 'home' : path.replace(/^\/+|\/+$/g, '');
  return `I'm on ${cleanPath}, what do you think?`;
}
