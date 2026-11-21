// Arcana Cup nameplates: the top 3 of each bracket in the first Arcana Cup show their name in a
// lettering built from their podium card, everywhere the site draws a player link. Styles are in
// nameplates.css (review page: /_review/arcana-nameplates.html). By account id.
// 154390881 placed 1st (TA) and 2nd (Satan) in Artistic; a name gets one style, so the 1st-place one.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const NAMEPLATES = {
  154390881: 'neon',  // 死ぬのがいいわ · Artistic 1st (TA card)
  94202887: 'gild',   // Math · Artistic 3rd
  127139604: 'hail',  // Scionara · Funny 1st
  75379546: 'sand',   // Brown · Funny 2nd (Sandstorm, his pick; Amber Glint was the first take)
  170288961: 'cook',  // slowz- · Funny 3rd
};

export const nameplateOf = (id) => NAMEPLATES[String(id ?? '')] ?? null;

// A name (plain text) wrapped in its owner's nameplate, or just escaped when they have none.
export function plateName(id, name) {
  const style = nameplateOf(id), text = esc(name);
  return style ? `<span class="np np-${style}" data-text="${text}">${text}</span>` : text;
}
