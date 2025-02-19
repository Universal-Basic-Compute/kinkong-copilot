async function fetchSignals() {
  try {
    const response = await fetch('https://swarmtrade.ai/api/airtable/SIGNALS');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || !data.records) {
      console.error('Unexpected API response format:', data);
      return [];
    }

    return data.records.map(record => record.fields);
  } catch (error) {
    console.error('Error fetching signals:', error);
    const tradingSignals = document.getElementById('trading-signals');
    tradingSignals.innerHTML = `<div style="color: #e74c3c; padding: 15px; text-align: center;">
      Error loading signals. Please try again later.
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

document.addEventListener('DOMContentLoaded', async function() {
  console.log('Extension loaded');

  // Handle connect wallet button
  const connectButton = document.querySelector('.button');
  connectButton.addEventListener('click', function() {
    // Add wallet connection logic here
    this.textContent = 'Connecting...';
    setTimeout(() => {
      this.textContent = 'Connected';
      this.style.backgroundColor = '#2ecc71';
    }, 1500);
  });

  const tradingSignals = document.getElementById('trading-signals');
  tradingSignals.innerHTML = '<div style="text-align: center;">Loading signals...</div>';

  const signals = await fetchSignals();
  tradingSignals.innerHTML = '';
  
  signals.forEach(signal => {
    tradingSignals.appendChild(renderSignal(signal));
  });
});
