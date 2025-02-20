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

export function isTelegram() {
  return window.location.hostname === 'web.telegram.org';
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
  if (isMeteora()) return 'meteora';

  // CEX additions
  if (isBinance()) return 'binance';
  if (isKucoin()) return 'kucoin';
  if (isOKX()) return 'okx';
  if (isBybit()) return 'bybit';
  if (isGate()) return 'gate';
  if (isMexc()) return 'mexc';
  
  // Social/Community additions
  if (isTelegram()) return 'telegram';
  
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
