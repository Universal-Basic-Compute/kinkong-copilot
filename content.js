function injectFloatingCopilot() {
  const style = document.createElement('style');
  style.textContent = `
    .kinkong-floating-copilot {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 80px;
      height: 80px;
      z-index: 999999;
      animation: kinkong-float 3s ease-in-out infinite;
      cursor: pointer;
    }

    @keyframes kinkong-float {
      0% {
        transform: translateY(0px);
      }
      50% {
        transform: translateY(-10px);
      }
      100% {
        transform: translateY(0px);
      }
    }
  `;
  document.head.appendChild(style);

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('assets/copilot.png');
  img.className = 'kinkong-floating-copilot';
  img.alt = 'KinKong Copilot';
  document.body.appendChild(img);
}

injectFloatingCopilot();
