let eventSource;
const SSE_ENDPOINT = 'https://swarmtrade.ai/api/notifications/stream';

function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  // Add headers to the request
  const headers = new Headers({
    'Accept': 'text/event-stream',
    'Cache-Control': 'no-cache'
  });

  // Create fetch request with proper headers
  fetch(SSE_ENDPOINT, {
    method: 'GET',
    headers: headers,
    credentials: 'include'
  }).then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    let buffer = '';

    function processText(text) {
      const messages = text.split('\n\n');
      messages.forEach(message => {
        if (message.trim()) {
          try {
            const data = JSON.parse(message.replace('data: ', ''));
            // Forward to active tabs
            chrome.tabs.query({active: true}, tabs => {
              tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                  type: 'SERVER_PUSH',
                  data: data
                });
              });
            });
          } catch (e) {
            console.error('Error parsing SSE message:', e);
          }
        }
      });
    }

    // Read the stream
    function readStream() {
      reader.read().then(({done, value}) => {
        if (done) {
          console.log('SSE connection closed');
          setTimeout(connectSSE, 5000); // Reconnect after 5 seconds
          return;
        }

        buffer += new TextDecoder().decode(value);
        const messages = buffer.split('\n\n');
        buffer = messages.pop(); // Keep the last incomplete message in buffer
        
        messages.forEach(message => {
          if (message.trim()) {
            processText(message);
          }
        });

        readStream();
      }).catch(error => {
        console.error('SSE read error:', error);
        setTimeout(connectSSE, 5000);
      });
    }

    readStream();
  }).catch(error => {
    console.error('SSE connection error:', error);
    setTimeout(connectSSE, 5000);
  });
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
