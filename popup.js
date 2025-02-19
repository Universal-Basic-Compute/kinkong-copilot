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

function getSignalEmoji(timeframe) {
  // Use the actual emoji characters directly
  const emojis = {
    'POSITION': '\u{1F3AF}', // 🎯
    'SWING': '\u{1F30A}',    // 🌊
    'INTRADAY': '\u{1F4C5}', // 📅
    'SCALP': '\u{26A1}'      // ⚡
  };
  
  return emojis[timeframe.toUpperCase()] || '';
}

function getSignalColor(type, confidence) {
  if (type === 'BUY') {
    return confidence === 'HIGH' ? '#2ecc71' : '#27ae60';
  }
  return confidence === 'HIGH' ? '#e74c3c' : '#c0392b';
}

function formatDate(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else {
    // For older dates, show the full date
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }
}

// Add metallic shine animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes metallicShine {
    0% {
      background-position: -100px;
    }
    40% {
      background-position: 200px;
    }
    100% {
      background-position: 200px;
    }
  }
`;
document.head.appendChild(styleSheet);

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
        <span style="
          font-weight: 300; 
          font-size: 16px;
          background: linear-gradient(
            90deg, 
            #8e8e8e 0%, 
            #d4d4d4 20%, 
            #ffffff 45%, 
            #d4d4d4 70%, 
            #8e8e8e 100%
          );
          background-size: 200px 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0px 1px 1px rgba(0,0,0,0.2);
          letter-spacing: 0.5px;
          animation: metallicShine 4s ease-in-out infinite;
          display: inline-block;
          position: relative;
        ">$${signal.token}</span>
        ${signal.virtual ? '<span style="background: #2d3436; color: #74b9ff; font-size: 11px; padding: 2px 6px; border-radius: 3px; margin-left: 6px;">VIRTUAL</span>' : ''}
      </div>
      <span style="color: ${getSignalColor(signal.type, signal.confidence)}; font-weight: 600; font-size: 14px;">
        ${signal.type} <span style="color: #666;">&bull;</span> ${getSignalEmoji(signal.timeframe)} ${signal.timeframe}
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
      <div style="color: #666; font-size: 11px;">${formatDate(signal.createdAt)}</div>
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

  const connectWalletBtn = document.getElementById('connect-wallet');
  const walletStatus = document.getElementById('wallet-status');

  connectWalletBtn.addEventListener('click', async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const account = accounts[0];
        
        // Update button state
        connectWalletBtn.classList.add('wallet-connected');
        connectWalletBtn.innerHTML = `
          <span class="wallet-icon">✓</span>
          ${account.slice(0, 6)}...${account.slice(-4)}
        `;
        
        walletStatus.textContent = 'Wallet connected successfully';
      } catch (error) {
        console.error('Error connecting wallet:', error);
        walletStatus.textContent = 'Error connecting wallet. Please try again.';
      }
    } else {
      walletStatus.textContent = 'Please install MetaMask to connect your wallet';
    }
  });

  const tradingSignals = document.getElementById('trading-signals');
  tradingSignals.innerHTML = '<div style="text-align: center;">Loading signals...</div>';

  const signals = await fetchSignals();
  tradingSignals.innerHTML = '';
  
  signals.forEach(signal => {
    tradingSignals.appendChild(renderSignal(signal));
  });

  // Settings functionality
  const settingsIcon = document.getElementById('settings-icon');
  const settingsPage = document.getElementById('settings-page');
  const backButton = document.getElementById('back-from-settings');
  const autoOpenChat = document.getElementById('auto-open-chat');
  const notificationSounds = document.getElementById('notification-sounds');
  const themeSelect = document.getElementById('theme-select');

  // Load saved settings
  chrome.storage.sync.get({
    autoOpenChat: true,
    notificationSounds: true,
    theme: 'dark'
  }, (items) => {
    autoOpenChat.checked = items.autoOpenChat;
    notificationSounds.checked = items.notificationSounds;
    themeSelect.value = items.theme;
  });

  // Save settings when changed
  autoOpenChat.addEventListener('change', () => {
    chrome.storage.sync.set({
      autoOpenChat: autoOpenChat.checked
    });
  });

  notificationSounds.addEventListener('change', () => {
    chrome.storage.sync.set({
      notificationSounds: notificationSounds.checked
    });
  });

  themeSelect.addEventListener('change', () => {
    chrome.storage.sync.set({
      theme: themeSelect.value
    });
  });

  // Toggle settings page
  settingsIcon.addEventListener('click', () => {
    settingsPage.classList.add('visible');
  });

  backButton.addEventListener('click', () => {
    settingsPage.classList.remove('visible');
  });
});
