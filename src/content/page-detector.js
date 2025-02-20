export function isXPage() {
  const hostname = window.location.hostname;
  return hostname === 'x.com' || hostname === 'twitter.com';
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

export function isSupportedPage() {
  // Currently implemented
  if (isDexScreenerTokenPage()) return 'dexscreener';
  if (isXPage()) return 'x';
  if (isSolscanPage()) return 'solscan';
  if (isSwarmTradePage()) return 'swarmtrade';
  if (isUBCPage()) return 'ubc';

  // New additions
  if (isRaydiumPage()) return 'raydium';
  if (isBirdeye()) return 'birdeye';
  if (isJupiter()) return 'jupiter';
  if (isTensorTrade()) return 'tensor';
  if (isMagicEden()) return 'magiceden';
  if (isOrcaPage()) return 'orca';
  if (isCoingecko()) return 'coingecko';
  if (isCoinMarketCap()) return 'coinmarketcap';
  
  return null;
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
