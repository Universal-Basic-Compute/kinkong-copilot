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
    
    // Add network check
    if (!navigator.onLine) {
      throw new Error('NETWORK_OFFLINE');
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
      // Continue without screenshot
    }

    // Add code, version, and screenshot to request data
    const requestData = {
      ...data,
      code: codeId,
      version: version,
      screenshot: screenshot // Will be null if capture failed
    };

  // Modify endpoint URL based on the endpoint parameter
  let apiUrl;
  if (endpoint === 'copilot') {
    // Use the new projects/kinkong/<code>/messages endpoint
    apiUrl = new URL(`https://kinos.onrender.com/api/projects/kinkong/${codeId}/messages`);
  } else {
    // Use the standard endpoint format for other API calls
    apiUrl = new URL(`https://kinos.onrender.com/api/${endpoint}`);
    apiUrl.searchParams.append('code', codeId);
  }

  console.group('API Request Details');
  console.log('Endpoint:', apiUrl.toString());
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

    // Parse JSON response if it's from the copilot endpoint
    if (endpoint === 'copilot') {
      try {
        const jsonData = JSON.parse(proxyResponse.data);
        console.log('[API] Received JSON response:', jsonData);
        
        // Return the response text from the JSON
        if (jsonData.response) {
          return new Response(jsonData.response, {
            status: proxyResponse.status || 200,
            headers: {
              'Content-Type': 'text/plain'
            }
          });
        }
      } catch (jsonError) {
        console.error('[API] Error parsing JSON response:', jsonError);
        // If JSON parsing fails, continue with the original response
      }
    }

    // Return the original response for non-JSON or fallback
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

    throw new Error('Unable to connect to KinOS API. The service may be down or blocked by CORS policy.');
  }
  } catch (error) {
    // Enhanced error categorization
    if (error.message === 'RATE_LIMIT_EXCEEDED') {
      throw error; // Propagate rate limit error specifically
    } else if (error.message === 'NETWORK_OFFLINE') {
      console.error('Network Error: User is offline');
      throw new Error('You appear to be offline. Please check your internet connection and try again.');
    } else if (error.message.includes('Extension context invalid')) {
      console.error('Context Error:', error);
      throw new Error('Browser extension context is invalid. Please try refreshing the page.');
    } else {
      console.error('API Error:', error);
      throw new Error('Unable to connect to KinOS API. The service may be down or blocked.');
    }
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
