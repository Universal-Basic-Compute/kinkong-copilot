// Add debug logs for configuration
console.log('[Config] Initializing background script');

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
      else if (hostname.includes('konginvest.ai')) siteName = 'konginvest';
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
    url: 'https://kinos.onrender.com',
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
    console.log('[Proxy] Request details:', {
      endpoint: request.endpoint,
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    
    // Create request options
    const options = {
      method: request.method,
      headers: request.headers
    };
    
    // Add body for POST requests
    if (request.method === 'POST' && request.body) {
      options.body = JSON.stringify(request.body);
    }
    
    // For GET requests with body, append as query parameters
    let endpoint = request.endpoint;
    if (request.method === 'GET' && request.body) {
      const url = new URL(endpoint);
      Object.entries(request.body).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
      endpoint = url.toString();
    }
    
    fetch(endpoint, options)
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
      
      // Get response as arrayBuffer for audio data
      const contentType = response.headers.get('content-type');
      let responseData;
      
      if (contentType && contentType.includes('audio/')) {
        // Handle audio data
        const arrayBuffer = await response.arrayBuffer();
        // Convert to base64 for transfer
        responseData = btoa(
          new Uint8Array(arrayBuffer)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
      } else {
        // Handle text/json data
        responseData = await response.text();
      }
      
      // Log first part of response for debugging
      console.log('[Proxy] Response type:', contentType);
      if (typeof responseData === 'string' && !contentType?.includes('audio/')) {
        console.log('[Proxy] Response text (first 100 chars):', responseData.substring(0, 100));
      } else {
        console.log('[Proxy] Binary response received');
      }
      
      sendResponse({ data: responseData, status: response.status });
    })
    .catch(error => {
      console.error('[Proxy] Fetch error:', error);
      sendResponse({ error: error.message });
    });
    
    return true; // Will respond asynchronously
  }
  
  // Handle TTS proxy requests
  if (request.type === 'ttsRequest') {
    fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body)
    })
    .then(async response => {
      if (!response.ok) {
        sendResponse({ 
          error: `TTS API error: ${response.status} ${response.statusText}`,
          status: response.status
        });
        return;
      }
      
      // Get the audio as array buffer
      const arrayBuffer = await response.arrayBuffer();
      
      // Convert to base64 for transfer
      const base64 = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      sendResponse({ data: base64, status: response.status });
    })
    .catch(error => {
      console.error('[TTS] Fetch error:', error);
      sendResponse({ error: error.message });
    });
    
    return true; // Will respond asynchronously
  }
  
  // Add new handler for screenshot capture
  if (request.type === 'captureScreenshot') {
    try {
      chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        if (!tabs || !tabs[0]) {
          sendResponse({ error: 'No active tab found', screenshot: null });
          return;
        }
        
        try {
          // Directly try to capture the screenshot without requesting permission
          // The activeTab permission in manifest should be sufficient
          chrome.tabs.captureVisibleTab(null, {format: 'jpeg', quality: 70}, (dataUrl) => {
            if (chrome.runtime.lastError) {
              console.error('Screenshot capture error:', chrome.runtime.lastError);
              sendResponse({ 
                error: chrome.runtime.lastError.message || 'Failed to capture screenshot',
                screenshot: null 
              });
              return;
            }
            
            // Resize the image
            resizeImage(dataUrl, 1568)
              .then(resizedDataUrl => {
                sendResponse({ screenshot: resizedDataUrl });
              })
              .catch(error => {
                console.error('Image resize error:', error);
                // Return the original image if resizing fails
                sendResponse({ screenshot: dataUrl });
              });
          });
        } catch (error) {
          console.error('Screenshot capture error:', error);
          sendResponse({ 
            error: error.message || 'Failed to capture screenshot',
            screenshot: null 
          });
        }
      });
    } catch (error) {
      console.error('Screenshot capture error:', error);
      sendResponse({ 
        error: error.message || 'Failed to capture screenshot',
        screenshot: null 
      });
    }
    
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

