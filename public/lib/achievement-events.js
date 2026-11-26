// Things the Worker can't see that earn an achievement (lib/achievements.js): saving a hero grid
// (parts/herogrid.js) and finishing a draft in the Drafter. Tells the Worker once per account per
// browser; signed out, nothing is recorded (do it again after signing in). Never throws.
import { steamAccount } from './store.js';

export async function recordAchievementEvent(event) {
  try {
    const account = await steamAccount();
    if (account == null) return;
    const key = `ad2l-ach-event:${account}:${event}`;
    if (localStorage.getItem(key)) return;
    // lib/cosmetics.js (card art and cosmetics) loads only when there's an event to send.
    const { collectionAction } = await import('./cosmetics.js');
    await collectionAction('record-event', { event });
    localStorage.setItem(key, '1');
  } catch { /* offline, blocked storage or not signed in: it counts the next time */ }
}
