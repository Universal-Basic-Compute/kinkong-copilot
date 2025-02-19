chrome.runtime.onInstalled.addListener(() => {
  console.log('KinKong Copilot Extension Installed');
});

// Handle proxy requests from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'proxyRequest') {
    fetch(request.endpoint, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body)
    })
    .then(response => response.json())
    .then(data => {
      sendResponse({ data });
    })
    .catch(error => {
      sendResponse({ error: error.message });
    });
    
    return true; // Will respond asynchronously
  }
});
