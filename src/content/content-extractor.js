export function extractVisibleContent() {
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '#content',
    '.content',
    '.main-content',
    'body'
  ];

  let mainContent = null;
  for (const selector of mainSelectors) {
    mainContent = document.querySelector(selector);
    if (mainContent) break;
  }

  mainContent = mainContent || document.body;

  const textNodes = [];
  const walker = document.createTreeWalker(
    mainContent,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const style = window.getComputedStyle(node.parentElement);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }

        if (node.parentElement.closest('.kinkong-chat-container') || 
            node.parentElement.closest('.kinkong-floating-copilot') ||
            node.parentElement.closest('.kinkong-message')) {
          return NodeFilter.FILTER_REJECT;
        }

        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(node.parentElement.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        const text = node.textContent.trim();
        if (!text) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.trim();
    if (text) {
      textNodes.push(text);
    }
  }

  const title = document.title || '';
  const description = document.querySelector('meta[name="description"]')?.content || '';

  const content = {
    url: window.location.href,
    pageContent: {
      title,
      description,
      mainContent: textNodes.join(' ').trim()
    }
  };

  Object.keys(content.pageContent).forEach(key => {
    if (!content.pageContent[key]) {
      delete content.pageContent[key];
    }
  });

  return content;
}

export function extractXContent() {
  const content = {
    url: window.location.href,
    pageContent: {}
  };

  try {
    const profileName = document.querySelector('[data-testid="UserName"]')?.textContent;
    const profileBio = document.querySelector('[data-testid="UserDescription"]')?.textContent;
    const profileLocation = document.querySelector('[data-testid="UserLocation"]')?.textContent;
    
    if (profileName) {
      content.pageContent.profile = {
        name: profileName,
        bio: profileBio,
        location: profileLocation
      };
    }

    const tweets = Array.from(document.querySelectorAll('[data-testid="tweet"]'));
    if (tweets.length > 0) {
      content.pageContent.tweets = tweets.map(tweet => ({
        text: tweet.querySelector('[data-testid="tweetText"]')?.textContent,
        time: tweet.querySelector('time')?.getAttribute('datetime'),
        engagement: {
          replies: tweet.querySelector('[data-testid="reply"]')?.textContent,
          retweets: tweet.querySelector('[data-testid="retweet"]')?.textContent,
          likes: tweet.querySelector('[data-testid="like"]')?.textContent
        }
      })).filter(tweet => tweet.text);
    }

    if (!content.pageContent.profile && !content.pageContent.tweets) {
      content.pageContent.mainContent = document.querySelector('[data-testid="primaryColumn"]')?.textContent;
    }

  } catch (error) {
    console.error('Error extracting X content:', error);
    content.pageContent.mainContent = document.body.textContent;
  }

  return content;
}
