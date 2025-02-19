document.addEventListener('DOMContentLoaded', function() {
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

  // Example of populating trading signals
  const tradingSignals = document.getElementById('trading-signals');
  const signals = [
    { pair: 'BTC/USDT', signal: 'STRONG BUY', probability: '85%' },
    { pair: 'ETH/USDT', signal: 'HOLD', probability: '60%' }
  ];

  signals.forEach(signal => {
    const signalElement = document.createElement('div');
    signalElement.style.padding = '10px';
    signalElement.style.marginBottom = '10px';
    signalElement.style.borderLeft = `3px solid ${signal.signal === 'STRONG BUY' ? '#2ecc71' : '#f1c40f'}`;
    signalElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: var(--primary-gold)">${signal.pair}</span>
        <span style="color: ${signal.signal === 'STRONG BUY' ? '#2ecc71' : '#f1c40f'}">${signal.signal}</span>
      </div>
      <div style="color: #888; font-size: 12px; margin-top: 5px;">
        Probability: ${signal.probability}
      </div>
    `;
    tradingSignals.appendChild(signalElement);
  });
});
