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
        // First inject all required files
        await chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: [
            'lib/marked.min.js',
            'lib/marked-bridge.js',
            'content.js'
          ]
        });

        // Inject CSS resources
        await chrome.scripting.insertCSS({
          target: {tabId: tab.id},
          css: `
            .kinkong-chat-container {
              position: fixed;
              bottom: 140px;
              right: 30px;
              width: 380px;
              height: 500px;
              background: rgba(26, 26, 26, 0.85);
              border: 1px solid rgba(255, 215, 0, 0.2);
              border-radius: 15px;
              overflow: hidden;
              box-shadow: 0 5px 20px rgba(0,0,0,0.5);
              display: none;
              flex-direction: column;
              z-index: 999999;
              opacity: 0;
              transform: translateY(20px);
              transition: all 0.3s ease;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            .kinkong-floating-copilot {
              position: fixed;
              bottom: 30px;
              right: 30px;
              width: 90px;
              height: 90px;
              cursor: pointer;
              z-index: 999999;
              animation: kinkong-float 3s ease-in-out infinite;
              filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
              transition: all 0.3s ease;
            }

            @keyframes kinkong-float {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
              100% { transform: translateY(0px); }
            }
          `
        });

        // Send follow-up message to show KinKong with the page content
        chrome.tabs.sendMessage(tab.id, {
          type: 'showKinKongIfInactive',
          pageContent: message.pageContent
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
