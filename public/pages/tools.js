// Tools (#/<league>/tools): the Drafter, Upload, the table builder and Feedback, the things you
// use rather than read. The nav's Tools dropdown lists the same entries (app.js NAV_MENUS.tools).
import { app, pageHead, esc } from "../core.js";

// Each: { id, name, sub, href } or, for Feedback, { action: "feedback" } instead of a page.
// The Drafter is AD2L-only (one division at a time); All divisions has no Upload.
export function toolList(src) {
  return [
    src.ad2l && !src.all && { id: "drafter", name: "Drafter", sub: "Draft against a team with the draft model's picks and bans.", href: `${src.root}/drafter` },
    !src.all && { id: "upload", name: "Upload", sub: src.ad2l ? "Add an unticketed game from its screenshots." : "Add a scrim from its screenshots.", href: `${src.root}/upload` },
    { id: "table", name: "Table builder", sub: "Any stat, any filter, as one sortable table.", href: `${src.root}/search?table=team` },
    { id: "feedback", name: "Feedback", sub: "Mark up any page and say what you'd change.", action: "feedback" },
  ].filter(Boolean);
}

// Feedback is a mode, not a page: the footer's Feedback button (lib/feedback.js) turns it on.
export const startFeedbackMode = () => document.getElementById("fb-open")?.click();

const ICONS = {
  drafter: '<path d="M5 4h6v7H5zM13 4h6v7h-6zM5 13h6v7H5zM13 13h6v7h-6z"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  feedback: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10.5h6M12 7.5v6"/>',
};
const icon = (id) => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[id]}</svg>`;

export function renderTools(src) {
  const card = (t) => {
    const body = `<span class="tool-icon">${icon(t.id)}</span><span class="tool-name">${esc(t.name)}</span><span class="tool-sub">${esc(t.sub)}</span>`;
    return t.action ? `<button type="button" class="tool-card" data-action="${t.action}">${body}</button>` : `<a class="tool-card" href="${t.href}">${body}</a>`;
  };
  app.innerHTML = `${pageHead(src.kicker, "Tools")}
    <div class="tool-grid reveal" style="--i:2">${toolList(src).map(card).join("")}</div>`;
  app.querySelector('[data-action="feedback"]')?.addEventListener("click", startFeedbackMode);
}
