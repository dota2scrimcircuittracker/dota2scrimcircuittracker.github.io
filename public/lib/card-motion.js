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
  // A Twin Card's two designs run one shared turn loop, so the pair pauses as one: watched card by
  // card, the turning card's box changes size and near the screen edge one design paused while the
  // other ran on, until both turned at once (the second card ghosting behind the first).
  const hostOf = (c) => (c.parentElement?.classList.contains('ft-twin') ? c.parentElement : c);
  const turnOf = (c) => c.getAnimations?.().find((a) => a.animationName?.startsWith('twin-'));
  const syncTwin = (twin) => {
    const [a, ...rest] = [...twin.children].map(turnOf);
    if (a?.currentTime == null) return;
    for (const b of rest) if (b) b.currentTime = a.currentTime;
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      e.target.toggleAttribute(OFF, !e.isIntersecting);
      if (e.isIntersecting && e.target.classList.contains('ft-twin')) syncTwin(e.target);
    }
  }, { rootMargin: '200px' });
  const watch = (node) => {
    if (node.nodeType !== 1) return;
    const cards = node.matches(HOSTS) ? [node] : node.querySelectorAll(HOSTS);
    for (const c of cards) {
      const host = hostOf(c);
      if (seen.has(host)) continue;
      seen.add(host); io.observe(host);
      // A card wrapped into a twin after it was first watched (the editor): the pair takes over.
      if (host !== c) for (const k of host.children) if (seen.has(k)) { io.unobserve(k); seen.delete(k); k.removeAttribute(OFF); }
    }
  };
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach(watch);
      r.removedNodes.forEach((n) => { if (n.nodeType === 1) (n.matches(HOSTS) ? [n] : n.querySelectorAll(HOSTS)).forEach((c) => { const h = hostOf(c); io.unobserve(h); seen.delete(h); }); });
    }
  }).observe(root, { childList: true, subtree: true });
  watch(document.body);
}
