// One column for every pop-up notice (gifts, comments, the Arcana Cup), bottom right. Each notice
// is its own card and the newest sits on top, so several never pile on one spot.
export function noticeStack() {
  let col = document.querySelector('.notice-stack');
  if (!col) { col = document.createElement('div'); col.className = 'notice-stack'; document.body.append(col); }
  return col;
}
export function pushCard(box) { noticeStack().prepend(box); }
