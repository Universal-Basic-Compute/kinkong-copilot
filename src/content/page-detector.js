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
  if (isDexScreenerTokenPage()) return 'dexscreener';
  if (isXPage()) return 'x';
  if (isSolscanPage()) return 'solscan';
  if (isSwarmTradePage()) return 'swarmtrade';
  if (isUBCPage()) return 'ubc';
  return null;
}
