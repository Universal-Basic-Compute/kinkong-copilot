async function fetchSignals() {
  try {
    const response = await fetch('https://swarmtrade.ai/api/airtable/SIGNALS');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Add debugging to see what we're getting back
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      
      if (!data || !data.records) {
        console.error('Unexpected API response format:', data);
        return [];
      }

      return data.records.map(record => record.fields);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Response was:', responseText.substring(0, 200) + '...'); // Show first 200 chars
      return [];
    }

  } catch (error) {
    console.error('Fetch Error:', error);
    const tradingSignals = document.getElementById('trading-signals');
    tradingSignals.innerHTML = `<div style="color: #e74c3c; padding: 15px; text-align: center;">
      Error loading signals. Please try again later.<br>
      <small style="color: #888;">${error.message}</small>
    </div>`;
    return [];
  }
}

function getSignalColor(type, confidence) {
  if (type === 'BUY') {
    return confidence === 'HIGH' ? '#2ecc71' : '#27ae60';
  }
  return confidence === 'HIGH' ? '#e74c3c' : '#c0392b';
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function renderSignal(signal) {
  const signalElement = document.createElement('div');
  signalElement.className = 'signal-card';
  signalElement.style.padding = '15px';
  signalElement.style.marginBottom = '15px';
  signalElement.style.borderLeft = `4px solid ${getSignalColor(signal.type, signal.confidence)}`;
  signalElement.style.backgroundColor = 'var(--secondary-black)';
  signalElement.style.borderRadius = '5px';

  signalElement.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="color: var(--primary-gold); font-weight: bold;">${signal.token}</span>
      <span style="color: ${getSignalColor(signal.type, signal.confidence)}">
        ${signal.type} • ${signal.timeframe}
      </span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px;">
      <div class="price-box">
        <div class="price-label">Entry</div>
        <div class="price-value">$${signal.entryPrice}</div>
      </div>
      <div class="price-box">
        <div class="price-label">Target</div>
        <div class="price-value">$${signal.targetPrice}</div>
      </div>
      <div class="price-box">
        <div class="price-label">Stop Loss</div>
        <div class="price-value">$${signal.stopLoss}</div>
      </div>
    </div>
    <div style="color: #888; font-size: 12px;">
      <div style="margin-bottom: 4px;">Confidence: ${signal.confidence}</div>
      <div style="margin-bottom: 4px;">Reason: ${signal.reason}</div>
      <div>Posted: ${formatDate(signal.timestamp)}</div>
    </div>
    ${signal.url ? `<a href="${signal.url}" target="_blank" style="color: var(--primary-gold); text-decoration: none; font-size: 12px; display: block; margin-top: 8px;">View Details →</a>` : ''}
  `;

  return signalElement;
}

const SUBSCRIPTION_PRICE_SOL = 1.5;
const RECEIVER_WALLET = 'YOUR_SOLANA_WALLET_ADDRESS';

async function checkSubscriptionStatus() {
  try {
    const response = await fetch('https://swarmtrade.ai/api/subscription/status');
    const data = await response.json();
    
    if (data.isSubscribed) {
      const subscribeButton = document.getElementById('subscribe-button');
      subscribeButton.textContent = 'Subscribed ✓';
      subscribeButton.classList.add('subscribed');
      subscribeButton.disabled = true;
      
      const statusDiv = document.querySelector('.subscription-status');
      const expiryDate = new Date(data.expiresAt).toLocaleDateString();
      statusDiv.textContent = `Premium access until ${expiryDate}`;
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
  }
}

async function connectPhantom() {
  try {
    // First check if Phantom is installed
    if (typeof window.solana === 'undefined') {
      throw new Error('Please install Phantom wallet');
    }

    // Check if it's actually Phantom
    if (!window.solana.isPhantom) {
      throw new Error('Please install Phantom wallet');
    }

    // Request connection
    const resp = await window.solana.connect();
    return resp.publicKey.toString();
  } catch (error) {
    if (error.code === 4001) { // User rejected the request
      throw new Error('Please connect your wallet');
    }
    throw error;
  }
}

async function makePayment() {
  try {
    const { solana } = window;
    if (!solana?.isPhantom) {
      throw new Error('Please install Phantom wallet');
    }

    const transaction = new solana.Transaction().add(
      solana.SystemProgram.transfer({
        fromPubkey: solana.publicKey,
        toPubkey: new solana.PublicKey(RECEIVER_WALLET),
        lamports: SUBSCRIPTION_PRICE_SOL * solana.LAMPORTS_PER_SOL
      })
    );

    const signature = await solana.signAndSendTransaction(transaction);
    
    // Notify backend about the payment
    const response = await fetch('https://swarmtrade.ai/api/subscription/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        signature,
        wallet: solana.publicKey.toString()
      })
    });

    if (!response.ok) {
      throw new Error('Failed to activate subscription');
    }

    return signature;
  } catch (error) {
    console.error('Payment error:', error);
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  console.log('Extension loaded');
  await checkSubscriptionStatus();

  const subscribeButton = document.getElementById('subscribe-button');
  const statusDiv = document.querySelector('.subscription-status');
  let walletConnected = false;

  subscribeButton.addEventListener('click', async () => {
    try {
      if (!walletConnected) {
        subscribeButton.textContent = 'Connecting...';
        await connectPhantom();
        walletConnected = true;
        subscribeButton.textContent = 'Pay 1.5 SOL';
      } else {
        subscribeButton.textContent = 'Processing...';
        subscribeButton.disabled = true;
        
        const signature = await makePayment();
        
        subscribeButton.textContent = 'Subscribed ✓';
        subscribeButton.classList.add('subscribed');
        statusDiv.textContent = 'Premium access activated for 3 months';
      }
    } catch (error) {
      console.error(error);
      subscribeButton.textContent = 'Connect Phantom';
      subscribeButton.disabled = false;
      statusDiv.textContent = `Error: ${error.message}`;
    }
  });

  const tradingSignals = document.getElementById('trading-signals');
  tradingSignals.innerHTML = '<div style="text-align: center;">Loading signals...</div>';

  const signals = await fetchSignals();
  tradingSignals.innerHTML = '';
  
  signals.forEach(signal => {
    tradingSignals.appendChild(renderSignal(signal));
  });
});
