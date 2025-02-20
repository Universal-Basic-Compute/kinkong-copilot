import { formatMessage } from './message-formatter.js';
import { saveMessage } from './chat-storage.js';

// Cache for interface elements
let interfaceElements = null;

export async function ensureChatInterface() {
  // Return cached elements if they exist
  if (interfaceElements) {
    return interfaceElements;
  }

  console.group('Chat Interface Initialization');
  console.log('Checking for existing interface...');
  
  try {
    // First check if container exists
    let shadowContainer = document.getElementById('kinkong-shadow-container');
    let shadow;

    if (!shadowContainer) {
      // Create new container and shadow root
      shadowContainer = document.createElement('div');
      shadowContainer.id = 'kinkong-shadow-container';
      document.body.appendChild(shadowContainer);
      shadow = shadowContainer.attachShadow({ mode: 'closed' });
      
      // Initialize the interface
      await initializeChatInterface(shadow);
    } else {
      // Get existing shadow root
      shadow = shadowContainer.shadowRoot;
      if (!shadow) {
        shadow = shadowContainer.attachShadow({ mode: 'closed' });
        await initializeChatInterface(shadow);
      }
    }

    // Cache and return interface elements
    interfaceElements = {
      messagesContainer: shadow.querySelector('.kinkong-chat-messages'),
      chatContainer: shadow.querySelector('.kinkong-chat-container'),
      copilotImage: shadow.querySelector('.kinkong-floating-copilot')
    };

    // Verify all elements exist
    if (!interfaceElements.messagesContainer || !interfaceElements.chatContainer || !interfaceElements.copilotImage) {
      throw new Error('Missing interface elements');
    }

    console.log('Interface ready');
    console.groupEnd();
    return interfaceElements;

  } catch (error) {
    console.error('Error ensuring chat interface:', error);
    console.groupEnd();
    throw new Error('Failed to create chat interface: ' + error.message);
  }
}

async function initializeChatInterface(shadow) {
  // Get saved preference
  const { copilotEnabled } = await chrome.storage.sync.get({ copilotEnabled: true });
        
  // Add styles
  const style = document.createElement('style');
  style.textContent = `/* ... existing styles ... */`;
  shadow.appendChild(style);

  // Create chat container
  const chatContainer = document.createElement('div');
  chatContainer.className = 'kinkong-chat-container';
  chatContainer.innerHTML = `
    <div class="kinkong-chat-messages"></div>
    <div class="kinkong-chat-input-container">
      <input type="text" class="kinkong-chat-input" placeholder="Type your message...">
      <button class="kinkong-chat-send">Send</button>
    </div>
  `;
  shadow.appendChild(chatContainer);

  // Create copilot image
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('assets/copilot.png');
  img.className = 'kinkong-floating-copilot';
  img.alt = 'KinKong Copilot';
  img.style.display = copilotEnabled ? 'block' : 'none';
  shadow.appendChild(img);

  // Add click handlers
  img.addEventListener('click', () => {
    if (chatContainer.classList.contains('visible')) {
      chatContainer.classList.remove('visible');
      setTimeout(() => {
        chatContainer.style.display = 'none';
      }, 300);
      img.style.animation = 'kinkong-float 3s ease-in-out infinite';
    } else {
      chatContainer.style.display = 'flex';
      requestAnimationFrame(() => {
        chatContainer.classList.add('visible');
      });
      img.style.animation = 'none';
    }
  });

  // Add message handlers
  const input = chatContainer.querySelector('.kinkong-chat-input');
  const sendButton = chatContainer.querySelector('.kinkong-chat-send');

  const sendMessage = () => {
    const message = input.value.trim();
    if (message) {
      addMessageToChatContainer(message, true);
      input.value = '';
    }
  };

  sendButton.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Wait for image to load
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load copilot image'));
  });
}

// Helper function to check if element is fully visible at top
function isElementFullyVisibleAtTop(element, container) {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  
  // Get the actual top position relative to the container
  const elementTop = elementRect.top - containerRect.top;
  
  // Check if element starts at or below the container's top edge
  return elementTop >= 0;
}

export async function addMessageToChatContainer(message, isUser = true, shouldSave = true) {
  const { messagesContainer, chatContainer, copilotImage } = ensureChatInterface();
  
  if (messagesContainer) {
    if (!chatContainer.classList.contains('visible')) {
      chatContainer.style.display = 'flex';
      requestAnimationFrame(() => {
        chatContainer.classList.add('visible');
      });
    }
    
    if (copilotImage) {
      copilotImage.style.animation = 'none';
    }

    // Function to smoothly scroll to an element
    const smoothScrollToElement = (element) => {
      const targetPosition = element.offsetTop;
      const startPosition = messagesContainer.scrollTop;
      const distance = targetPosition - startPosition;
      const duration = 300; // ms
      let start = null;
      
      const animation = (currentTime) => {
        if (!start) start = currentTime;
        const progress = currentTime - start;
        const percentage = Math.min(progress / duration, 1);
        
        // Easing function for smooth animation
        const easeOutCubic = percentage => 1 - Math.pow(1 - percentage, 3);
        
        messagesContainer.scrollTop = startPosition + distance * easeOutCubic(percentage);
        
        if (percentage < 1) {
          requestAnimationFrame(animation);
        }
      };
      
      requestAnimationFrame(animation);
    };

    // Split messages only for bot responses (non-user messages)
    if (!isUser) {
      const paragraphs = message.split(/\n\s*\n/);
      const WORDS_PER_MINUTE = 250;
      const MILLISECONDS_PER_WORD = (60 * 1000) / WORDS_PER_MINUTE;
      
      for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
          const tempDiv = document.createElement('div');
          tempDiv.className = `kinkong-message ${isUser ? 'user' : 'bot'}`;
          tempDiv.style.opacity = '0';
          tempDiv.style.transform = 'translateY(10px)';
          tempDiv.style.transition = 'all 0.3s ease';
          tempDiv.innerHTML = formatMessage(paragraph.trim());
          
          messagesContainer.appendChild(tempDiv);
          
          // Check if the new bubble is fully visible at the top
          if (!isElementFullyVisibleAtTop(tempDiv, messagesContainer)) {
            tempDiv.remove();
            continue;
          }
          
          // Trigger fade-in animation and scroll
          await new Promise(resolve => setTimeout(() => {
            tempDiv.style.opacity = '1';
            tempDiv.style.transform = 'translateY(0)';
            
            // Smooth scroll to the new message
            tempDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            resolve();
          }, 100));

          const wordCount = paragraph.trim().split(/\s+/).length;
          const readingDelay = Math.max(500, wordCount * MILLISECONDS_PER_WORD);
          await new Promise(resolve => setTimeout(resolve, readingDelay));
        }
      }
    } else {
      // User messages
      const tempDiv = document.createElement('div');
      tempDiv.className = `kinkong-message ${isUser ? 'user' : 'bot'}`;
      tempDiv.innerHTML = formatMessage(message);
      
      messagesContainer.appendChild(tempDiv);
      
      // Check if the new bubble is fully visible at the top
      if (!isElementFullyVisibleAtTop(tempDiv, messagesContainer)) {
        tempDiv.remove();
        return;
      }
      
      // Smooth scroll to the new message
      tempDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    if (shouldSave) {
      saveMessage(message, isUser);
    }
  }
}
