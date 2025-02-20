let eventSource;
const SSE_ENDPOINT = 'https://swarmtrade.ai/api/notifications/stream';

function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(SSE_ENDPOINT);
  
  eventSource.onopen = () => {
    console.log('SSE connection established');
  };

  eventSource.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      
      // Forward to active tabs as a regular chat message
      const tabs = await chrome.tabs.query({active: true});
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'CHAT_MESSAGE',
          data: {
            content: message.text,
            isUser: false
          }
        });
      });

    } catch (error) {
      console.error('Error handling SSE message:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    eventSource.close();
    setTimeout(connectSSE, 5000);
  };
}

// Initialize SSE connection when extension starts
connectSSE();

// Handle content script injection
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_CONTENT') {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0];
      // Skip chrome:// and edge:// URLs
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        return;
      }
      
      try {
        // Inject all necessary files
        await chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ['content.js']
        });
        // Send follow-up message to show KinKong
        chrome.tabs.sendMessage(tab.id, {
          type: 'showKinKongIfInactive'
        });
      } catch (error) {
        console.error('Injection failed:', error);
      }
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('KinKong Copilot Extension Installed');
  
  // Check if third-party cookies are enabled
  chrome.cookies.get({
    url: 'https://swarmtrade.ai',
    name: 'test_cookie'
  }, function(cookie) {
    if (!cookie) {
      console.log('Third-party cookies may be disabled');
      // Could show a notification to the user here
    }
  });
});

// Handle proxy requests from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'proxyRequest') {
    fetch(request.endpoint, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body)
    })
    .then(async response => {
      // Get response as text instead of trying to parse JSON
      const text = await response.text();
      sendResponse({ data: text });
    })
    .catch(error => {
      sendResponse({ error: error.message });
    });
    
    return true; // Will respond asynchronously
  }
});

// Clean up when extension is shutting down
chrome.runtime.onSuspend.addListener(() => {
  if (eventSource) {
    eventSource.close();
  }
});
