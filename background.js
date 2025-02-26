let eventSource;
let sseConnected = false;
let reconnectTimeout = null;
let signalPollingInterval = null;
const SSE_ENDPOINT = 'https://swarmtrade.ai/api/notifications/stream';
const AIRTABLE_ENDPOINT = 'https://api.airtable.com/v0/appXXXXXXXXXXXXXX/Signals'; // Replace with your Airtable base ID
const AIRTABLE_API_KEY = 'keyXXXXXXXXXXXXXX'; // Replace with your Airtable API key
const POLLING_INTERVAL = 20000; // 20 seconds

function connectSSE() {
  // Don't create a new connection if one is already active
  if (sseConnected) {
    console.log('[SSE] Already connected, skipping reconnection');
    return;
  }
  
  // Clear any pending reconnect timeouts
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  console.log('[SSE] Establishing connection to', SSE_ENDPOINT);
  
  // Close existing connection if any
  if (eventSource) {
    console.log('[SSE] Closing existing connection');
    eventSource.close();
    eventSource = null;
  }

  // Create a proper EventSource connection
  try {
    eventSource = new EventSource(SSE_ENDPOINT, {
      withCredentials: true
    });
    
    // Set up event handlers
    eventSource.onopen = (event) => {
      console.log('[SSE] Connection established successfully');
      sseConnected = true;
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Forward to active tabs
        chrome.tabs.query({active: true}, tabs => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'SERVER_PUSH',
              data: data
            }).catch(err => {
              // Suppress errors from inactive tabs
              console.debug('[SSE] Could not send to tab, may be inactive');
            });
          });
        });
      } catch (e) {
        console.error('[SSE] Error parsing message:', e);
      }
    };
    
    eventSource.onerror = (event) => {
      console.error('[SSE] Connection error:', event);
      sseConnected = false;
      
      // Close the connection on error
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      
      // Set up reconnection
      console.log('[SSE] Will attempt to reconnect in 5 seconds');
      reconnectTimeout = setTimeout(connectSSE, 5000);
    };
    
  } catch (error) {
    console.error('[SSE] Failed to create EventSource:', error);
    sseConnected = false;
    reconnectTimeout = setTimeout(connectSSE, 5000);
  }
}

function checkSSEConnection() {
  console.log('[SSE] Checking connection status: ' + (sseConnected ? 'Connected' : 'Disconnected'));
  
  if (!sseConnected) {
    console.log('[SSE] Connection lost, attempting to reconnect');
    connectSSE();
  }
}

// Initialize SSE connection when extension starts
connectSSE();

// Start signal polling on extension startup
startSignalPolling();

// Set up periodic connection check (every 30 seconds)
setInterval(checkSSEConnection, 30000);

// Add tab and window focus listeners to maintain SSE connection
chrome.tabs.onActivated.addListener(() => {
  console.log('[SSE] Tab activated, checking connection');
  checkSSEConnection();
  
  // Start signal polling for the newly activated tab
  startSignalPolling();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    console.log('[SSE] Window focused, checking connection');
    checkSSEConnection();
    
    // Start signal polling when window gets focus
    startSignalPolling();
  } else {
    // Stop polling when window loses focus
    stopSignalPolling();
  }
});

// Add this listener to stop polling when tab is changed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    // Stop polling when navigating to a new page
    stopSignalPolling();
  } else if (changeInfo.status === 'complete') {
    // Restart polling when page is fully loaded
    startSignalPolling();
  }
});

// Add listener to handle browser coming back online
self.addEventListener('online', () => {
  console.log('[SSE] Browser back online, checking connection');
  checkSSEConnection();
});

// Handle content script injection
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_CONTENT') {
    console.log('Received INJECT_CONTENT message', message);
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0];
      
      // Skip chrome:// and edge:// URLs
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
        console.log('Skipping injection for browser URL:', tab.url);
        return;
      }

      // Get the hostname from the URL
      const url = new URL(tab.url);
      const hostname = url.hostname;
      console.log('Injecting content script for hostname:', hostname);

      // Determine site name from hostname
      let siteName = '';
      if (hostname.includes('dexscreener.com')) siteName = 'dexscreener';
      else if (hostname.includes('twitter.com') || hostname.includes('x.com')) siteName = 'twitter';
      else if (hostname.includes('solscan.io')) siteName = 'solscan';
      else if (hostname.includes('swarmtrade.ai')) siteName = 'swarmtrade';
      else if (hostname.includes('universalbasiccompute.ai')) siteName = 'ubc';
      else if (hostname.includes('raydium.io')) siteName = 'raydium';
      else if (hostname.includes('birdeye.so')) siteName = 'birdeye';
      else if (hostname.includes('jup.ag')) siteName = 'jupiter';
      else if (hostname.includes('tensor.trade')) siteName = 'tensor';
      else if (hostname.includes('magiceden.io')) siteName = 'magiceden';
      else if (hostname.includes('orca.so')) siteName = 'orca';
      else if (hostname.includes('meteora.ag')) siteName = 'meteora';
      else if (hostname.includes('binance.com')) siteName = 'binance';
      else if (hostname.includes('kucoin.com')) siteName = 'kucoin';
      else if (hostname.includes('okx.com')) siteName = 'okx';
      else if (hostname.includes('bybit.com')) siteName = 'bybit';
      else if (hostname.includes('gate.io')) siteName = 'gate';
      else if (hostname.includes('mexc.com')) siteName = 'mexc';
      else if (hostname.includes('web.telegram.org')) siteName = 'telegram';
      else if (hostname.includes('coingecko.com')) siteName = 'coingecko';
      else if (hostname.includes('coinmarketcap.com')) siteName = 'coinmarketcap';

      // Check if site is activated
      const result = await chrome.storage.sync.get(['site_toggles']);
      const savedToggles = result.site_toggles || {};
      const isActivated = savedToggles[siteName] !== false;
      
      if (!isActivated) {
        console.log(`Site ${siteName} is not activated`);
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
              width: 100px;
              height: 100px;
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
  
  // Add new handler for screenshot capture
  if (request.type === 'captureScreenshot') {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (!tabs || !tabs[0]) {
        sendResponse({ error: 'No active tab found' });
        return;
      }
      
      try {
        // Capture the visible tab
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {format: 'jpeg', quality: 70});
        
        // Resize the image to 1568px width
        const resizedDataUrl = await resizeImage(dataUrl, 1568);
        
        sendResponse({ screenshot: resizedDataUrl });
      } catch (error) {
        console.error('Screenshot capture error:', error);
        sendResponse({ error: error.message || 'Failed to capture screenshot' });
      }
    });
    
    return true; // Will respond asynchronously
  }
});

// Function to resize an image
function resizeImage(dataUrl, targetWidth) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.height / img.width;
      const targetHeight = Math.round(targetWidth * aspectRatio);
      
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      
      // Convert to JPEG with reduced quality to keep size reasonable
      const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
      resolve(resizedDataUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for resizing'));
    };
    
    img.src = dataUrl;
  });
}

// Function to start polling for signals from Airtable
function startSignalPolling() {
  // Clear any existing interval
  if (signalPollingInterval) {
    clearInterval(signalPollingInterval);
    signalPollingInterval = null;
  }
  
  // Define the polling function
  const pollForSignals = async () => {
    try {
      console.log('[Signal Polling] Checking for new signals...');
      
      // Get the active tab
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tabs || tabs.length === 0) {
        console.log('[Signal Polling] No active tab found');
        return;
      }
      
      // Make request to Airtable
      const response = await fetch(`${AIRTABLE_ENDPOINT}?sort%5B0%5D%5Bfield%5D=createdAt&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=10`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.records || data.records.length === 0) {
        console.log('[Signal Polling] No signals found');
        return;
      }
      
      // Get current time
      const now = new Date();
      
      // Filter signals less than 1 hour old
      const recentSignals = data.records.filter(record => {
        const createdAt = new Date(record.fields.createdAt);
        const diffMs = now - createdAt;
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours < 1;
      });
      
      if (recentSignals.length === 0) {
        console.log('[Signal Polling] No recent signals found');
        return;
      }
      
      console.log(`[Signal Polling] Found ${recentSignals.length} recent signals`);
      
      // Send signals to active tab
      for (const signal of recentSignals) {
        // Format the signal data
        const formattedSignal = {
          id: signal.id,
          token: signal.fields.token,
          type: signal.fields.type,
          entryPrice: signal.fields.entryPrice,
          targetPrice: signal.fields.targetPrice,
          stopLoss: signal.fields.stopLoss,
          timeframe: signal.fields.timeframe,
          confidence: signal.fields.confidence,
          createdAt: signal.fields.createdAt
        };
        
        // Send to active tab
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'SERVER_PUSH',
          data: {
            type: 'SIGNAL',
            signal: formattedSignal
          }
        }).catch(err => {
          console.debug('[Signal Polling] Could not send to tab, may be inactive');
        });
      }
      
    } catch (error) {
      console.error('[Signal Polling] Error:', error);
    }
  };
  
  // Run immediately on start
  pollForSignals();
  
  // Set up interval
  signalPollingInterval = setInterval(pollForSignals, POLLING_INTERVAL);
  console.log(`[Signal Polling] Started polling every ${POLLING_INTERVAL/1000} seconds`);
}

// Function to stop signal polling
function stopSignalPolling() {
  if (signalPollingInterval) {
    clearInterval(signalPollingInterval);
    signalPollingInterval = null;
    console.log('[Signal Polling] Stopped polling');
  }
}

// Clean up when extension is shutting down
chrome.runtime.onSuspend.addListener(() => {
  console.log('[SSE] Extension suspending, cleaning up SSE connection');
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (signalPollingInterval) {
    clearInterval(signalPollingInterval);
    signalPollingInterval = null;
  }
  
  sseConnected = false;
});
