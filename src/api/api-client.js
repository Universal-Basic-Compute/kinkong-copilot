import { getOrCreateWalletId } from '../chat/chat-interface.js';

export async function makeApiCall(endpoint, data) {
  try {
    // Get the generated wallet ID
    const walletId = await getOrCreateWalletId();

    // Add wallet to request data
    const requestData = {
      ...data,
      wallet: walletId
    };

  console.group('API Request Details');
  console.log('Endpoint:', `https://swarmtrade.ai/api/${endpoint}`);
  console.log('Request Headers:', {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': window.location.origin
  });
  console.log('Request Body:', JSON.stringify(requestData, null, 2));
  console.groupEnd();

  try {
    const proxyResponse = await chrome.runtime.sendMessage({
      type: 'proxyRequest',
      endpoint: `https://swarmtrade.ai/api/${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain, application/json'
      },
      body: requestData
    });

    if (proxyResponse.error) {
      throw new Error(proxyResponse.error);
    }

    return new Response(proxyResponse.data, {
      status: 200,
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
    console.error('API Error:', error);
    throw error;
  }
}
