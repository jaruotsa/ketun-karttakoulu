// The site as an app: registers the service worker (sw.js), so that the pages also work without a
// network. Browsers that have no service worker (or the page is not on HTTPS) show the pages
// normally.
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // E.g. private browsing: the pages work, but not without a network.
    });
  });
}
