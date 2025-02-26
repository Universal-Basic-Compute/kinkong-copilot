window.addEventListener('marked-ready', () => {
  window.formatMarkdown = (text) => {
    return marked.parse(text, {
      breaks: true,
      gfm: true,
      sanitize: true
    });
  };
});
