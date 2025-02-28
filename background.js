let signalPollingInterval = null;
const SWARMTRADE_NOTIFICATIONS_ENDPOINT = 'https://swarmtrade.ai/api/notifications/latest';
const POLLING_INTERVAL = 20000; // 20 seconds

// Add debug logs for configuration
console.log('[Config] Initializing background script');
console.log(`[Config] SWARMTRADE_NOTIFICATIONS_ENDPOINT: ${SWARMTRADE_NOTIFICATIONS_ENDPOINT}`);
console.log(`[Config] POLLING_INTERVAL: ${POLLING_INTERVAL}ms`);

// Function to get or create wallet ID for authentication
async function getWalletId() {
  try {
    // Check if ID exists in storage
    const result = await chrome.storage.local.get('walletId');
    
    // Return existing ID if valid
    if (result.walletId && result.walletId !== '803c7488f8632c0b9506c6f2fec75405') {
      return result.walletId;
    }

    // Generate new random code if none exists
    const buffer = new Uint8Array(32);
    crypto.getRandomValues(buffer);
    
    // Convert to 32-char hex string
    const walletId = Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 32);

    // Save to local storage
    await chrome.storage.local.set({ walletId: walletId });

    return walletId;
  } catch (error) {
    console.error('[Wallet] Error managing wallet ID:', error);
    return '803c7488f8632c0b9506c6f2fec75405'; // Default code if error
  }
}

// Start signal polling on extension startup
startSignalPolling();

// Add tab and window focus listeners to maintain polling
chrome.tabs.onActivated.addListener(() => {
  // Start signal polling for the newly activated tab
  startSignalPolling();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
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
  console.log('[Polling] Browser back online, restarting polling');
  startSignalPolling();
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
      // Check if response is ok
      if (!response.ok) {
        console.error(`[Proxy] API error: ${response.status} ${response.statusText}`);
        sendResponse({ 
          error: `API error: ${response.status} ${response.statusText}`,
          status: response.status
        });
        return;
      }
      
      // Log response headers for debugging
      console.log('[Proxy] Response headers:', 
        Array.from(response.headers.entries())
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ')
      );
      
      // Get response as text instead of trying to parse JSON
      const text = await response.text();
      
      // Log first part of response for debugging
      console.log('[Proxy] Response text (first 100 chars):', text.substring(0, 100));
      
      sendResponse({ data: text, status: response.status });
    })
    .catch(error => {
      console.error('[Proxy] Fetch error:', error);
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

// Function to start polling for signals from SwarmTrade API
function startSignalPolling() {
  // Clear any existing interval
  if (signalPollingInterval) {
    clearInterval(signalPollingInterval);
    signalPollingInterval = null;
    console.log('[Signal Polling] Cleared existing polling interval');
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
      
      console.log(`[Signal Polling] Active tab: ${tabs[0].url}`);
      
      // Get wallet ID for authentication
      const walletId = await getWalletId();
      console.log(`[Signal Polling] Using wallet ID: ${walletId.substring(0, 8)}...`);
      
      // Create URL with authentication parameter
      const apiUrl = new URL(SWARMTRADE_NOTIFICATIONS_ENDPOINT);
      apiUrl.searchParams.append('code', walletId);
      
      // Make request to SwarmTrade API with authentication
      console.log(`[Signal Polling] Requesting data from SwarmTrade: ${apiUrl.toString()}`);
      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`[Signal Polling] SwarmTrade API error: ${response.status} ${response.statusText}`);
        throw new Error(`SwarmTrade API error: ${response.status}`);
      }
      
      // Parse response as text first to debug
      const responseText = await response.text();
      console.log('[Signal Polling] Response text:', responseText);
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('[Signal Polling] JSON parse error:', e);
        console.log('[Signal Polling] Response was not valid JSON:', responseText);
        throw new Error('Response was not valid JSON');
      }
      
      // Check if the API returned a message about no signals
      if (data.message === "No recent signals found") {
        console.log('[Signal Polling] API reports no recent signals');
        return;
      }
      
      // If we have signals data, process it
      if (!data.signals || data.signals.length === 0) {
        console.log('[Signal Polling] No signals found in SwarmTrade response');
        return;
      }
      
      console.log(`[Signal Polling] Found ${data.signals.length} total signals in SwarmTrade API`);
      
      // Get current time
      const now = new Date();
      console.log(`[Signal Polling] Current time: ${now.toISOString()}`);
      
      // Filter signals less than 1 hour old
      const recentSignals = data.signals.filter(signal => {
        const createdAt = new Date(signal.createdAt);
        const diffMs = now - createdAt;
        const diffHours = diffMs / (1000 * 60 * 60);
        console.log(`[Signal Polling] Signal ${signal.id} created at ${createdAt.toISOString()}, ${diffHours.toFixed(2)} hours old`);
        return diffHours < 1;
      });
      
      if (recentSignals.length === 0) {
        console.log('[Signal Polling] No recent signals found (less than 1 hour old)');
        return;
      }
      
      console.log(`[Signal Polling] Found ${recentSignals.length} recent signals (less than 1 hour old)`);
      
      // Send signals to active tab
      for (const signal of recentSignals) {
        // Format the signal data
        const formattedSignal = {
          id: signal.id,
          token: signal.token,
          type: signal.type,
          entryPrice: signal.entryPrice,
          targetPrice: signal.targetPrice,
          stopLoss: signal.stopLoss,
          timeframe: signal.timeframe,
          confidence: signal.confidence,
          createdAt: signal.createdAt
        };
        
        console.log(`[Signal Polling] Sending signal to tab: ${JSON.stringify(formattedSignal)}`);
        
        // Send to active tab
        try {
          await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SERVER_PUSH',
            data: {
              type: 'SIGNAL',
              signal: formattedSignal
            }
          });
          console.log(`[Signal Polling] Successfully sent signal ${signal.id} to tab ${tabs[0].id}`);
        } catch (err) {
          console.error(`[Signal Polling] Error sending signal to tab: ${err.message}`);
        }
      }
      
    } catch (error) {
      console.error('[Signal Polling] Error:', error);
    }
  };
  
  // Run immediately on start
  console.log('[Signal Polling] Running initial poll');
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
  console.log('[Polling] Extension suspending, cleaning up polling');
  
  if (signalPollingInterval) {
    clearInterval(signalPollingInterval);
    signalPollingInterval = null;
  }
});
