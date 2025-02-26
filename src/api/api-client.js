import { getOrCreateWalletId } from '../chat/chat-interface.js';

// Helper function to check if extension context is valid
function isExtensionContextValid() {
  try {
    chrome.runtime.getURL('');
    return true;
  } catch (e) {
    return false;
  }
}

export async function makeApiCall(endpoint, data) {
  try {
    // Check context validity first
    if (!isExtensionContextValid()) {
      throw new Error('Extension context invalid, cannot make API call');
    }
    
    // Get the generated code ID and version
    const codeId = await getOrCreateWalletId();
    const version = '1.2.0'; // Version from manifest.json/config.js

    // Capture screenshot
    let screenshot = null;
    try {
      screenshot = await captureScreenshot();
    } catch (screenshotError) {
      console.warn('Failed to capture screenshot:', screenshotError);
    }

    // Add code, version, and screenshot to request data
    const requestData = {
      ...data,
      code: codeId,
      version: version,
      screenshot: screenshot
    };

  console.group('API Request Details');
  console.log('Endpoint:', `https://swarmtrade.ai/api/${endpoint}`);
  console.log('Request Headers:', {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': window.location.origin
  });
  console.log('Request Body:', JSON.stringify({
    ...requestData,
    screenshot: screenshot ? '[SCREENSHOT DATA]' : null
  }, null, 2));
  console.groupEnd();

  try {
    // Create URL with authentication parameter
    const apiUrl = new URL(`https://swarmtrade.ai/api/${endpoint}`);
    apiUrl.searchParams.append('code', codeId);
    
    const proxyResponse = await chrome.runtime.sendMessage({
      type: 'proxyRequest',
      endpoint: apiUrl.toString(),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain'
      },
      body: requestData
    });

    // Add rate limit detection
    if (proxyResponse.status === 429) { // HTTP 429 is Too Many Requests
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    if (proxyResponse.error) {
      throw new Error(proxyResponse.error);
    }

    // Check if response looks like HTML (might be an error page)
    if (proxyResponse.data && 
        (proxyResponse.data.trim().startsWith('<!DOCTYPE') || 
         proxyResponse.data.trim().startsWith('<html'))) {
      console.error('[API] Received HTML response instead of expected data');
      console.log('[API] HTML response preview:', proxyResponse.data.substring(0, 200));
      throw new Error('Received HTML response instead of expected data. The API endpoint may be unavailable.');
    }

    return new Response(proxyResponse.data, {
      status: proxyResponse.status || 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });

  } catch (error) {
    console.group('API Error Details');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('Request Data:', {
      endpoint,
      data,
      origin: window.location.origin,
      online: navigator.onLine,
      userAgent: navigator.userAgent
    });
    console.groupEnd();

    throw new Error('Unable to connect to SwarmTrade API. The service may be down or blocked by CORS policy.');
  }
  } catch (error) {
    if (error.message === 'RATE_LIMIT_EXCEEDED') {
      throw error; // Propagate rate limit error specifically
    }
    console.error('API Error:', error);
    throw error;
  }
}

// Function to capture and resize screenshot
async function captureScreenshot() {
  // Check context validity first
  if (!isExtensionContextValid()) {
    throw new Error('Extension context invalid, cannot capture screenshot');
  }
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'captureScreenshot' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      
      if (response.screenshot) {
        resolve(response.screenshot);
      } else {
        reject(new Error('No screenshot data received'));
      }
    });
  });
}
