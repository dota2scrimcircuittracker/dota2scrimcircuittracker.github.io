// Card cosmetics animate backgrounds, masks and blends, which repaint every frame. A phone can't
// repaint them and scroll at once (parts of the page blink in and out), so they pause while the
// page scrolls (html.cards-still, CSS) and while a card or feed post is off screen
// ([data-effects-offscreen]).
const OFF = 'data-effects-offscreen', HOSTS = '.ft-card, .feed-post';

export function startCardMotion() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  let still = 0;
  addEventListener('scroll', () => {
    if (!still) root.classList.add('cards-still');
    clearTimeout(still);
    still = setTimeout(() => { still = 0; root.classList.remove('cards-still'); }, 150);
  }, { passive: true, capture: true });

  if (typeof IntersectionObserver === 'undefined') return;
  const seen = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.toggleAttribute(OFF, !e.isIntersecting);
  }, { rootMargin: '200px' });
  const watch = (node) => {
    if (node.nodeType !== 1) return;
    const cards = node.matches(HOSTS) ? [node] : node.querySelectorAll(HOSTS);
    for (const c of cards) if (!seen.has(c)) { seen.add(c); io.observe(c); }
  };
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach(watch);
      r.removedNodes.forEach((n) => { if (n.nodeType === 1) (n.matches(HOSTS) ? [n] : n.querySelectorAll(HOSTS)).forEach((c) => { io.unobserve(c); seen.delete(c); }); });
    }
  }).observe(root, { childList: true, subtree: true });
  watch(document.body);
}
