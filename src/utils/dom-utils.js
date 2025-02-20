// Helper function to find content using multiple selectors and text matching
export function findContent(selectors) {
  for (const selector of selectors) {
    // Handle special case for text content matching
    if (selector.includes(':contains(')) {
      const basicSelector = selector.split(':contains(')[0];
      const searchText = selector.match(/contains\("(.+)"\)/)[1];
      
      // Find elements matching basic selector
      const elements = document.querySelectorAll(basicSelector);
      for (const element of elements) {
        if (element.textContent.includes(searchText)) {
          return element.textContent.trim();
        }
      }
      continue;
    }

    // Regular selector
    const element = document.querySelector(selector);
    if (element) {
      const text = element.textContent.trim();
      if (text) return text;
    }
  }
  return '';
}

// Helper function to find price-like numbers in text
export function findPrices(text) {
  const priceRegex = /\$\s*\d+(?:[.,]\d+)?/g;
  const matches = text.match(priceRegex);
  return matches || [];
}

export function waitForDOM() {
  return new Promise(resolve => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      resolve();
    }
  });
}

export async function waitForElement(selector, timeout = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Timeout waiting for element: ${selector}`);
}

export async function waitForXContent() {
  const maxWaitTime = 5000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const timeline = document.querySelector('[data-testid="primaryColumn"]');
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    const profileInfo = document.querySelector('[data-testid="UserName"]');
    
    if ((timeline && tweets.length > 0) || profileInfo) {
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return false;
}

export async function waitForDexScreenerElements() {
  const maxWaitTime = 5000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    console.log(`Checking elements... Time elapsed: ${Date.now() - startTime}ms`);
    
    const tokenName = document.querySelector('[data-cy="token-name"]');
    const tokenSymbol = document.querySelector('[data-cy="token-symbol"]');
    const price = document.querySelector('[data-cy="price"]');
    
    if (tokenName && tokenSymbol && price) {
      console.log('Found all DexScreener elements');
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('Timeout reached, proceeding with partial content');
  return false;
}
