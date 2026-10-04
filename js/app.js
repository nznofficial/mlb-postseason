import { fetchSchedule, fetchRecent, currentSeason } from './api.js';
import { renderCalendar, scrollToToday } from './calendar.js';
import { renderLive } from './live.js';
import { renderDetail } from './detail.js';
import { tzAbbr } from './format.js';

const POLL_MS = 30_000;
const SOON_MS = 15 * 60_000; // start polling this long before first pitch

const $ = (id) => document.getElementById(id);
const els = {
  calendar: $('calendar'), live: $('live'), liveCount: $('live-count'),
  updated: $('last-updated'), error: $('error-banner'),
  detail: $('detail'), detailBody: $('detail-body'),
};

const season = currentSeason();
const games = new Map(); // gamePk → normalized game
let pollTimer = null;
let openPk = null;

$('season-year').textContent = season;
$('tz-name').textContent = `${Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')} (${tzAbbr()})`;

// ---- tabs -------------------------------------------------------------
function showTab() {
  const tab = location.hash === '#live' ? 'live' : 'calendar';
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.view !== tab; });
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === tab));
}
addEventListener('hashchange', showTab);
showTab();

// ---- rendering ----------------------------------------------------------
function render({ scroll = false } = {}) {
  const list = [...games.values()];
  renderCalendar(els.calendar, list);
  const liveN = renderLive(els.live, list);
  els.liveCount.hidden = !liveN;
  els.liveCount.textContent = liveN;
  els.updated.textContent = `Updated ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  if (openPk && els.detail.open && games.has(openPk)) renderDetail(els.detailBody, games.get(openPk));
  if (scroll) scrollToToday(els.calendar);
}

function merge(list) {
  for (const g of list) games.set(g.pk, g);
}

async function load(fetcher, opts) {
  try {
    merge(await fetcher());
    els.error.hidden = true;
    render(opts);
  } catch (err) {
    console.error(err);
    els.error.hidden = false;
    if (!games.size) els.calendar.innerHTML = '<p class="empty-state">Schedule unavailable. Try again shortly.</p>';
  }
  schedulePoll();
}

// ---- polling ------------------------------------------------------------
function needsPolling() {
  const now = Date.now();
  return [...games.values()].some((g) =>
    g.isLive || (!g.isFinal && !g.timeTBD && !g.isPostponed && g.date - now < SOON_MS && now - g.date < 6 * 3600_000));
}

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = null;
  if (document.hidden || !needsPolling()) return;
  pollTimer = setTimeout(() => load(fetchRecent), POLL_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearTimeout(pollTimer); pollTimer = null; }
  else load(fetchRecent); // catch up right away when the tab comes back
});

// ---- detail dialog ----------------------------------------------------------
function openDetail(pk) {
  const g = games.get(pk);
  if (!g) return;
  openPk = pk;
  renderDetail(els.detailBody, g);
  els.detail.showModal();
}
document.addEventListener('click', (e) => {
  const card = e.target.closest('[data-pk]');
  if (card) openDetail(Number(card.dataset.pk));
  else if (e.target === els.detail) els.detail.close(); // backdrop click
});
document.addEventListener('keydown', (e) => {
  const card = e.target.closest?.('.live-card[data-pk]');
  if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetail(Number(card.dataset.pk)); }
});
els.detail.addEventListener('close', () => { openPk = null; });

// ---- manual refresh -----------------------------------------------------------
const fullRefresh = () => load(() => fetchSchedule(season));
$('refresh-btn').addEventListener('click', fullRefresh);
$('retry-btn').addEventListener('click', fullRefresh);

load(() => fetchSchedule(season), { scroll: true });
