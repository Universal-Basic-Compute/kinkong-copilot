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

// Add SSE message handler
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SERVER_PUSH') {
    handleServerPush(message.data);
  }
});

function handleServerPush(data) {
  switch(data.type) {
    case 'SIGNAL':
      // Add new signal to the trading signals list
      const tradingSignals = document.getElementById('trading-signals');
      tradingSignals.insertBefore(renderSignal(data.signal), tradingSignals.firstChild);
      break;
      
    case 'PRICE_ALERT':
      // Update price information
      updatePriceAlert(data);
      break;
      
    case 'SYSTEM_MESSAGE':
      // Show system message
      showSystemMessage(data.message);
      break;
  }
}

function showSystemMessage(message) {
  const statusDiv = document.createElement('div');
  statusDiv.className = 'system-message';
  statusDiv.textContent = message;
  statusDiv.style.cssText = `
    background: rgba(255, 215, 0, 0.1);
    border-left: 3px solid var(--primary-gold);
    padding: 10px;
    margin: 10px 0;
    animation: fadeIn 0.3s ease;
  `;
  
  const container = document.querySelector('.container');
  container.insertBefore(statusDiv, container.firstChild);
  
  // Remove after 5 seconds
  setTimeout(() => {
    statusDiv.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => statusDiv.remove(), 300);
  }, 5000);
}

// Add helper functions for site activation
async function getSiteActivationState(siteName) {
  const result = await chrome.storage.sync.get(['site_toggles']);
  const savedToggles = result.site_toggles || {};
  // Default to enabled if no saved state
  return savedToggles[siteName] !== false;
}

async function isSiteActivated(siteName) {
  return await getSiteActivationState(siteName);
}

import { getOrCreateCodeId } from '../src/chat/chat-interface.js';

document.addEventListener('DOMContentLoaded', async function() {
  // Configure premium subscription link with code
  const premiumLink = document.getElementById('premium-link');
  try {
    const codeId = await getOrCreateCodeId();
    premiumLink.href = `https://swarmtrade.ai/copilot?code=${codeId}`;
  } catch (error) {
    console.error('Error setting premium link:', error);
    premiumLink.href = 'https://swarmtrade.ai/copilot';
  }

  // Load saved toggle states
  const toggles = document.querySelectorAll('.site-toggle input');
  
  toggles.forEach(toggle => {
    const siteItem = toggle.closest('.site-item');
    const siteName = siteItem.dataset.site;
    
    // Load saved state
    chrome.storage.sync.get(['site_toggles'], function(result) {
      const savedToggles = result.site_toggles || {};
      // Default to enabled if no saved state
      toggle.checked = savedToggles[siteName] !== false;
    });
    
    // Save state on change
    toggle.addEventListener('change', function() {
      chrome.storage.sync.get(['site_toggles'], function(result) {
        const savedToggles = result.site_toggles || {};
        savedToggles[siteName] = toggle.checked;
        chrome.storage.sync.set({
          site_toggles: savedToggles
        });
      });
    });
  });
  
  toggles.forEach(toggle => {
    const siteItem = toggle.closest('.site-item');
    const siteName = siteItem.dataset.site;
    
    // Load saved state
    chrome.storage.sync.get(['site_toggles'], function(result) {
      const savedToggles = result.site_toggles || {};
      // Default to enabled if no saved state
      toggle.checked = savedToggles[siteName] !== false;
    });
    
    // Save state on change
    toggle.addEventListener('change', function() {
      chrome.storage.sync.get(['site_toggles'], function(result) {
        const savedToggles = result.site_toggles || {};
        savedToggles[siteName] = toggle.checked;
        chrome.storage.sync.set({
          site_toggles: savedToggles
        });
      });
    });
  });
  
  chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
    const currentTab = tabs[0];
    
    try {
      // Skip chrome:// and edge:// URLs
      if (!currentTab.url || currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('edge://')) {
        return;
      }

      // Execute content script to extract page content
      const [{result: pageContent}] = await chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        func: () => {
          // Simple content extraction function
          const mainContent = document.body.innerText;
          const title = document.title;
          return {
            url: window.location.href,
            pageContent: {
              title: title,
              mainContent: mainContent
            }
          };
        }
      });

      // Then try to show KinKong with the extracted content
      try {
        await chrome.tabs.sendMessage(currentTab.id, {
          type: 'showKinKongIfInactive',
          pageContent: pageContent
        });
      } catch (e) {
        // If message fails (content script not present), inject it first
        chrome.runtime.sendMessage({
          type: 'INJECT_CONTENT',
          pageContent: pageContent
        });
      }

    } catch (error) {
      console.error('Error extracting page content:', error);
    }
  });

  // await checkSubscriptionStatus();

  // Add toggle control
  const copilotToggle = document.getElementById('copilot-enabled');

  // Load saved preference
  chrome.storage.sync.get({
    copilotEnabled: true
  }, (items) => {
    copilotToggle.checked = items.copilotEnabled;
  });

  // Save preference when changed
  copilotToggle.addEventListener('change', () => {
    const enabled = copilotToggle.checked;
    chrome.storage.sync.set({ copilotEnabled: enabled });
    // Send message to content script to update state
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'updateCopilotState',
        enabled: enabled
      });
    });
  });

  const connectWalletBtn = document.getElementById('connect-wallet');
  const walletStatus = document.getElementById('wallet-status');

  // Check if wallet was previously connected
  chrome.storage.local.get(['walletConnected', 'walletAddress'], (result) => {
    if (result.walletConnected && result.walletAddress) {
      connectWalletBtn.classList.add('wallet-connected');
      connectWalletBtn.innerHTML = `
        <span class="wallet-icon">✓</span>
        ${result.walletAddress.slice(0, 6)}...${result.walletAddress.slice(-4)}
      `;
      walletStatus.textContent = 'Phantom wallet connected';
      walletStatus.style.color = '#2ecc71';
    }
  });

  connectWalletBtn.addEventListener('click', connectPhantomWallet);

  const tradingSignals = document.getElementById('trading-signals');
  tradingSignals.innerHTML = '<div style="text-align: center;">Loading signals...</div>';

  const signals = await fetchSignals();
  tradingSignals.innerHTML = '';
  
  signals.forEach(signal => {
    tradingSignals.appendChild(renderSignal(signal));
  });

  // Settings functionality - simplified version
  const settingsIcon = document.getElementById('settings-icon');
  const settingsPage = document.getElementById('settings-page');
  const backButton = document.getElementById('back-from-settings');

  // Toggle settings page
  settingsIcon.addEventListener('click', () => {
    settingsPage.classList.add('visible');
  });

  backButton.addEventListener('click', () => {
    settingsPage.classList.remove('visible');
  });
});
async function connectPhantomWallet() {
  const connectWalletBtn = document.getElementById('connect-wallet');
  const walletStatus = document.getElementById('wallet-status');

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if we're on a webpage (not chrome:// or edge://)
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      walletStatus.textContent = 'Please open wallet on a webpage';
      walletStatus.style.color = '#e74c3c';
      return;
    }

    // Show connecting status
    connectWalletBtn.disabled = true;
    walletStatus.textContent = 'Connecting...';
    walletStatus.style.color = '#f39c12';

    // Send message to content script
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { 
        type: 'PHANTOM_CONNECT_REQUEST' 
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ error: 'Content script not ready' });
        } else {
          resolve(response);
        }
      });
    });

    // Re-enable button
    connectWalletBtn.disabled = false;

    if (!response) {
      throw new Error('No response from content script');
    }

    if (response.error) {
      if (response.error === 'Phantom not installed') {
        walletStatus.textContent = 'Please install Phantom wallet';
        walletStatus.style.color = '#e74c3c';
        // Only open Phantom website if user clicks the button again
        connectWalletBtn.textContent = 'Install Phantom';
        connectWalletBtn.onclick = () => window.open('https://phantom.app/', '_blank');
      } else if (response.error === 'Content script not ready') {
        walletStatus.textContent = 'Please refresh the page';
        walletStatus.style.color = '#e74c3c';
      } else {
        walletStatus.textContent = response.error;
        walletStatus.style.color = '#e74c3c';
      }
      return;
    }

    if (response.publicKey) {
      // Update button state
      connectWalletBtn.classList.add('wallet-connected');
      connectWalletBtn.innerHTML = `
        <span class="wallet-icon">✓</span>
        ${response.publicKey.slice(0, 6)}...${response.publicKey.slice(-4)}
      `;
      
      walletStatus.textContent = 'Phantom wallet connected';
      walletStatus.style.color = '#2ecc71';

      // Save wallet connection state
      chrome.storage.local.set({
        walletConnected: true,
        walletAddress: response.publicKey
      });
    }

  } catch (error) {
    console.error('Phantom connection error:', error);
    connectWalletBtn.disabled = false;
    walletStatus.textContent = 'Error connecting to Phantom wallet';
    walletStatus.style.color = '#e74c3c';
  }
}
