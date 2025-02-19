let markedReady = false;

// Initialize marked library
const markedScript = document.createElement('script');
markedScript.src = chrome.runtime.getURL('lib/marked.min.js');
document.head.appendChild(markedScript);

const bridgeScript = document.createElement('script');
bridgeScript.src = chrome.runtime.getURL('lib/marked-bridge.js');
document.head.appendChild(bridgeScript);

markedScript.onload = () => {
  markedReady = true;
  window.dispatchEvent(new Event('marked-ready'));
};

export function formatMessage(text) {
  if (markedReady && window.formatMarkdown) {
    try {
      return window.formatMarkdown(text);
    } catch (e) {
      console.error('Error formatting markdown:', e);
      return text;
    }
  }
  return text;
}
