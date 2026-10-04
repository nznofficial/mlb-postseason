import { logoUrl, darkLogoUrl } from './teams.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const tzFmt = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' });

export function tzAbbr(date = new Date()) {
  return tzFmt.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value || '';
}

export function gameTime(game) {
  if (game.timeTBD) return 'TBD';
  return `${timeFmt.format(game.date)} ${tzAbbr(game.date)}`;
}

/** YYYY-MM-DD in the viewer's local zone. */
export function localKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calendar day a game belongs on. Games with a TBD time use MLB's official date
 * (their placeholder timestamp would otherwise land on the wrong local day).
 */
export function gameDayKey(game) {
  return game.timeTBD ? game.officialDate : localKey(game.date);
}

export function teamLogo(team, size = 20) {
  if (!team.real) return `<span class="logo logo-tbd" style="width:${size}px;height:${size}px" aria-hidden="true">?</span>`;
  return `<picture class="logo"><source srcset="${darkLogoUrl(team.id)}" media="(prefers-color-scheme: dark)"><img src="${logoUrl(team.id)}" width="${size}" height="${size}" alt="" loading="lazy"></picture>`;
}

export function inningLabel(ls) {
  if (!ls.inning) return '';
  const arrow = { Top: '▲', Bottom: '▼', Middle: 'Mid', End: 'End' }[ls.inningState] || '';
  return `${arrow} ${ls.inningOrdinal}`;
}

export function statusBadge(game) {
  if (game.isPostponed) return `<span class="status-badge warn">${esc(game.detailedState)}</span>`;
  if (game.isDelayed) return `<span class="status-badge warn">Delayed</span>`;
  return '';
}

export const roundClass = (game) => `round-${game.round.toLowerCase()}`;
