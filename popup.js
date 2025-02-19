async function fetchSignals() {
  try {
    const response = await fetch('https://swarmtrade.ai/api/signals');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.error('Unexpected API response format:', data);
      return [];
    }

    // The data is already in the format we need, just return it
    return data;

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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <div>
        <span style="color: var(--primary-gold); font-weight: bold; font-size: 16px;">${signal.token}</span>
        ${signal.virtual ? '<span style="background: #2d3436; color: #74b9ff; font-size: 11px; padding: 2px 6px; border-radius: 3px; margin-left: 6px;">VIRTUAL</span>' : ''}
      </div>
      <span style="color: ${getSignalColor(signal.type, signal.confidence)}; font-weight: 600; font-size: 14px;">
        ${signal.type} <span style="color: #666;">&bull;</span> ${signal.timeframe}
      </span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
      <div class="price-box" style="background: rgba(0,0,0,0.2); padding: 10px;">
        <div class="price-label" style="color: #888; font-size: 11px; margin-bottom: 4px;">Entry</div>
        <div class="price-value" style="color: var(--primary-gold); font-weight: bold; font-size: 15px;">$${signal.entryPrice}</div>
      </div>
      <div class="price-box" style="background: rgba(0,0,0,0.2); padding: 10px;">
        <div class="price-label" style="color: #888; font-size: 11px; margin-bottom: 4px;">Target</div>
        <div class="price-value" style="color: var(--primary-gold); font-weight: bold; font-size: 15px;">$${signal.targetPrice}</div>
      </div>
      <div class="price-box" style="background: rgba(0,0,0,0.2); padding: 10px;">
        <div class="price-label" style="color: #888; font-size: 11px; margin-bottom: 4px;">Stop Loss</div>
        <div class="price-value" style="color: var(--primary-gold); font-weight: bold; font-size: 15px;">$${signal.stopLoss}</div>
      </div>
    </div>
    <div style="color: #888; font-size: 12px; line-height: 1.4;">
      <div style="margin-bottom: 6px;">
        <span style="color: #ddd; font-weight: 600;">Confidence:</span> 
        <span style="color: ${signal.confidence === 'HIGH' ? '#2ecc71' : '#f1c40f'}">${signal.confidence}</span>
      </div>
      <div style="margin-bottom: 6px; color: #ddd;">
        <span style="color: #ddd; font-weight: 600;">Reason:</span> 
        <span style="color: #bbb;">${signal.reason}</span>
      </div>
      <div style="color: #666; font-size: 11px;">Posted: ${formatDate(signal.timestamp)}</div>
    </div>
    ${signal.url ? `<a href="${signal.url}" target="_blank" style="color: var(--primary-gold); text-decoration: none; font-size: 12px; display: block; margin-top: 8px;">View Details →</a>` : ''}
  `;

  return signalElement;
}

/*
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
*/

document.addEventListener('DOMContentLoaded', async function() {
  // await checkSubscriptionStatus();

  const tradingSignals = document.getElementById('trading-signals');
  tradingSignals.innerHTML = '<div style="text-align: center;">Loading signals...</div>';

  const signals = await fetchSignals();
  tradingSignals.innerHTML = '';
  
  signals.forEach(signal => {
    tradingSignals.appendChild(renderSignal(signal));
  });
});
