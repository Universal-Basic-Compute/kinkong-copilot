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
    const pageType = await isSupportedPage();
    if (!pageType) return;

    // Get activation state
    const result = await chrome.storage.sync.get(['site_toggles']);
    const savedToggles = result.site_toggles || {};
    const isActivated = savedToggles[pageType] !== false;
    
    if (!isActivated) {
      console.log(`Site ${pageType} is not activated`);
      return;
    }

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

    const { messagesContainer } = interfaceElements;

    await displayStoredMessages().catch(err => {
      console.warn('Failed to load stored messages:', err);
    });
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
  return `I'm on ${window.location.href}, what do you think?`;
}
