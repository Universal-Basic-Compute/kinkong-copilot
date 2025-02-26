export async function extractPDFContent() {
  try {
    // Check if it's a PDF URL
    if (!window.location.href.toLowerCase().endsWith('.pdf')) {
      return null;
    }

    // For PDFs loaded in browser
    const pdfContent = {
      url: window.location.href,
      pageContent: {
        title: document.title || 'PDF Document',
        mainContent: ''
      }
    };

    // Try multiple methods to get PDF content
    const methods = [
      // Method 1: Get all visible text content
      () => document.body.innerText,
      
      // Method 2: Get specific viewer content
      () => {
        const viewer = document.querySelector('#viewer');
        return viewer ? viewer.innerText : '';
      },
      
      // Method 3: Get from common PDF viewer elements
      () => {
        const elements = document.querySelectorAll('.textLayer, .pdfViewer, #viewerContainer');
        return Array.from(elements)
          .map(el => el.innerText)
          .join('\n')
          .trim();
      },
      
      // Method 4: Get all pre-formatted text
      () => {
        const pres = document.querySelectorAll('pre');
        return Array.from(pres)
          .map(pre => pre.innerText)
          .join('\n')
          .trim();
      }
    ];

    // Try each method until we get content
    for (const method of methods) {
      try {
        const content = method();
        if (content && content.trim().length > 0) {
          pdfContent.pageContent.mainContent = content;
          break;
        }
      } catch (e) {
        console.warn('PDF extraction method failed:', e);
        continue;
      }
    }

    // If still no content, try to get any text content
    if (!pdfContent.pageContent.mainContent) {
      const textNodes = document.evaluate(
        '//text()',
        document.body,
        null,
        XPathResult.ANY_TYPE,
        null
      );
      
      let node;
      let text = [];
      while (node = textNodes.iterateNext()) {
        const content = node.textContent.trim();
        if (content) {
          text.push(content);
        }
      }
      
      pdfContent.pageContent.mainContent = text.join(' ');
    }

    // If still no content, provide default message
    if (!pdfContent.pageContent.mainContent) {
      pdfContent.pageContent.mainContent = "This appears to be a PDF document. I can see it's a PDF but I'm having trouble reading its contents. Could you paste the specific section you'd like me to analyze?";
    }

    // Add metadata if available
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      pdfContent.pageContent.description = metaDescription.content;
    }

    // Log extraction results
    console.group('PDF Content Extraction');
    console.log('URL:', pdfContent.url);
    console.log('Title:', pdfContent.pageContent.title);
    console.log('Content Length:', pdfContent.pageContent.mainContent.length);
    console.log('Content Preview:', pdfContent.pageContent.mainContent.substring(0, 200) + '...');
    console.groupEnd();

    return pdfContent;

  } catch (error) {
    console.error('Error extracting PDF content:', error);
    return {
      url: window.location.href,
      pageContent: {
        title: document.title || 'PDF Document',
        mainContent: "This appears to be a PDF document. I encountered an error while trying to read it. Could you paste the specific section you'd like me to analyze?"
      }
    };
  }
}

export function extractVisibleContent() {
  // Check if it's a PDF first
  if (window.location.href.toLowerCase().endsWith('.pdf')) {
    return extractPDFContent();
  }

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
