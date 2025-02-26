export function isXPage() {
  const hostname = window.location.hostname;
  const isXDomain = hostname === 'x.com' || hostname === 'twitter.com';
  const isMessagesPage = window.location.pathname === '/messages';
  
  return isXDomain && !isMessagesPage;
}

export function isSwarmTradePage() {
  return window.location.hostname === 'swarmtrade.ai';
}

export function isUBCPage() {
  return window.location.hostname === 'universalbasiccompute.ai';
}

export function isDexScreenerTokenPage() {
  const isDex = window.location.hostname === 'dexscreener.com';
  const hasPath = window.location.pathname.split('/').length >= 3;
  const notHome = window.location.pathname !== '/';
  return isDex && hasPath && notHome;
}

export function isSolscanPage() {
  return window.location.hostname === 'solscan.io';
}

export function isTelegram() {
  // Check if we're on telegram web
  if (window.location.hostname !== 'web.telegram.org') return false;
  
  // Check if we're in a group chat by looking for negative numbers in the URL
  // Group chat IDs are negative numbers
  const path = window.location.hash;
  const matches = path.match(/#-\d+/);
  
  return matches !== null;
}

export async function isSupportedPage() {
  const hostname = window.location.hostname;
  let siteName = null;

  // Map hostname to site name
  if (hostname === 'dexscreener.com') siteName = 'dexscreener';
  else if (hostname === 'x.com' || hostname === 'twitter.com') siteName = 'twitter';
  else if (hostname === 'solscan.io') siteName = 'solscan';
  else if (hostname === 'swarmtrade.ai') siteName = 'swarmtrade';
  else if (hostname === 'universalbasiccompute.ai') siteName = 'ubc';
  else if (hostname === 'raydium.io') siteName = 'raydium';
  else if (hostname === 'birdeye.so') siteName = 'birdeye';
  else if (hostname === 'jup.ag') siteName = 'jupiter';
  else if (hostname === 'tensor.trade') siteName = 'tensor';
  else if (hostname === 'magiceden.io') siteName = 'magiceden';
  else if (hostname === 'orca.so') siteName = 'orca';
  else if (hostname === 'meteora.ag') siteName = 'meteora';
  else if (hostname === 'binance.com') siteName = 'binance';
  else if (hostname === 'kucoin.com') siteName = 'kucoin';
  else if (hostname === 'okx.com') siteName = 'okx';
  else if (hostname === 'bybit.com') siteName = 'bybit';
  else if (hostname === 'gate.io') siteName = 'gate';
  else if (hostname === 'mexc.com') siteName = 'mexc';
  else if (hostname === 'web.telegram.org') siteName = 'telegram';
  else if (hostname === 'coingecko.com') siteName = 'coingecko';
  else if (hostname === 'coinmarketcap.com') siteName = 'coinmarketcap';
  else if (hostname === 'dyor.com') siteName = 'dyor';

  if (!siteName) return null;

  // Check if site is activated
  const result = await chrome.storage.sync.get(['site_toggles']);
  const savedToggles = result.site_toggles || {};
  
  // Return site name only if activated
  return savedToggles[siteName] !== false ? siteName : null;
}

// New detection functions
export function isRaydiumPage() {
  return window.location.hostname === 'raydium.io';
}

export function isBirdeye() {
  return window.location.hostname === 'birdeye.so';
}

export function isJupiter() {
  return window.location.hostname === 'jup.ag';
}

export function isTensorTrade() {
  return window.location.hostname === 'tensor.trade';
}

export function isMagicEden() {
  return window.location.hostname === 'magiceden.io';
}

export function isOrcaPage() {
  return window.location.hostname === 'orca.so';
}

export function isCoingecko() {
  return window.location.hostname === 'coingecko.com';
}

export function isCoinMarketCap() {
  return window.location.hostname === 'coinmarketcap.com';
}

export function isMeteora() {
  return window.location.hostname === 'app.meteora.ag';
}

// Add new CEX detection functions
export function isBinance() {
  return window.location.hostname === 'www.binance.com';
}

export function isKucoin() {
  return window.location.hostname === 'www.kucoin.com';
}

export function isOKX() {
  return window.location.hostname === 'www.okx.com';
}

export function isBybit() {
  return window.location.hostname === 'www.bybit.com';
}

export function isGate() {
  return window.location.hostname === 'www.gate.io';
}

export function isMexc() {
  return window.location.hostname === 'www.mexc.com';
}

export function isDyor() {
  return window.location.hostname === 'dyor.com';
}
