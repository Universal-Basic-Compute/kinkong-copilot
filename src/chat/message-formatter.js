let markedReady = false;

// Initialize marked library
const markedScript = document.createElement('script');
markedScript.src = chrome.runtime.getURL('lib/marked.min.js');
document.head.appendChild(markedScript);

const bridgeScript = document.createElement('script');
bridgeScript.src = chrome.runtime.getURL('lib/marked-bridge.js');
document.head.appendChild(bridgeScript);

// Wait for both scripts to load
Promise.all([
  new Promise(resolve => markedScript.onload = resolve),
  new Promise(resolve => bridgeScript.onload = resolve)
]).then(() => {
  markedReady = true;
  window.dispatchEvent(new Event('marked-ready'));
});

export function formatMessage(text) {
  // Wait for marked to be ready
  if (!markedReady || !window.formatMarkdown) {
    // If marked isn't ready, add basic formatting
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #ffd700; text-decoration: underline;">$1</a>')
      .replace(/\n/g, '<br>');
  }

  try {
    const formattedText = window.formatMarkdown(text);
    return formattedText
      .replace(/<p>/g, '<div>')  // Replace paragraph tags with divs
      .replace(/<\/p>/g, '</div>')  // Close div tags
      .replace(/<pre>/g, '<pre style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; overflow-x: auto;">')  // Style code blocks
      .replace(/<code>/g, '<code style="background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 3px;">')  // Style inline code
      .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" style="color: #ffd700; text-decoration: underline;" '); // Style links
  } catch (e) {
    console.error('Error formatting markdown:', e);
    return text;
  }
}
