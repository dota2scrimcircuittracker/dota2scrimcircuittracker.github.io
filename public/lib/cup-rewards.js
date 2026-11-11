// Arcana Cup winners' rewards. Set by hand by Fav. On the winner's profile the video takes the
// achievements column's place, left of their cards (parts/collection.js mountProfileCollection);
// achievements stay on the Achievements tab.
// video: a YouTube video id, embedded through youtube-nocookie.com.
export const CUP_REWARDS = Object.freeze({
  // Scion-ara: winner of Arcana Cup 1, Funny bracket.
  '127139604': { title: 'Arcana Cup winner · Funny', video: 'tCzrzP5V24o' },
});

export const cupRewardOf = (key) => {
  const r = CUP_REWARDS[String(key)];
  return r && /^[\w-]{11}$/.test(r.video) ? r : null;
};

// The reward column's inner HTML, or '' if they have no reward.
export function cupRewardHtml(key, esc) {
  const r = cupRewardOf(key);
  if (!r) return '';
  return `<h3>🏆 ${esc(r.title)}</h3>
    <div class="cup-reward-video"><iframe src="https://www.youtube-nocookie.com/embed/${r.video}" title="${esc(r.title)}" loading="lazy"
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
}
