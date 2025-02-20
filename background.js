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

  eventSource.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      // Broadcast to all extension instances
      chrome.runtime.sendMessage({
        type: 'SERVER_PUSH', 
        data: message
      });
    } catch (error) {
      console.error('Error parsing SSE message:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    eventSource.close();
    // Attempt to reconnect after 5 seconds
    setTimeout(connectSSE, 5000);
  };
}

// Initialize SSE connection when extension starts
connectSSE();

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
