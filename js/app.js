import { fetchSchedule, fetchRecent, fetchSeeds, currentSeason } from './api.js';
import { renderCalendar, scrollToToday } from './calendar.js';
import { renderLive } from './live.js';
import { renderDetail } from './detail.js';
import { tzAbbr } from './format.js';
import { renderHero } from './hero.js';
import { renderBracket, renderSeriesDetail } from './bracket.js';

const POLL_MS = 30_000;
const SOON_MS = 15 * 60_000; // start polling this long before first pitch

const $ = (id) => document.getElementById(id);
const els = {
  bracket: $('bracket-root'), calendar: $('calendar-root'), live: $('live-root'), liveCount: $('live-count'),
  updated: $('last-updated'), error: $('error-banner'),
  detail: $('detail'), detailBody: $('detail-body'),
};

const season = currentSeason();
const games = new Map(); // gamePk → normalized game
let seeds = new Map(); // teamId → playoff seed
let series = new Map(); // series id → bracket series
let pollTimer = null;
let openView = null; // { type: 'game', pk, fromSeries? } | { type: 'series', id }
let calendarScrolled = false;

$('season-year').textContent = season;
$('tz-name').textContent = `Times in ${tzAbbr()}`;
$('tz-name').title = Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');

// ---- tabs -------------------------------------------------------------
const TABS = ['bracket', 'calendar', 'live'];
function showTab() {
  const tab = TABS.find((t) => location.hash === `#${t}`) || 'bracket';
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.view !== tab; });
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === tab));
  // jump to today's games the first time the calendar is shown
  if (tab === 'calendar' && !calendarScrolled && games.size) { calendarScrolled = true; scrollToToday(els.calendar); }
}
addEventListener('hashchange', showTab);
showTab();

// ---- rendering ----------------------------------------------------------
function render() {
  const list = [...games.values()];
  series = renderBracket(els.bracket, list, seeds);
  renderCalendar(els.calendar, list);
  const liveN = renderLive(els.live, list);
  renderHero($('hero-next'), list);
  els.liveCount.hidden = !liveN;
  els.liveCount.textContent = liveN;
  els.updated.textContent = `Updated ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  if (els.detail.open && openView) showView(openView);
}

function merge(list) {
  for (const g of list) games.set(g.pk, g);
}

async function load(fetcher) {
  try {
    merge(await fetcher());
    els.error.hidden = true;
    render();
  } catch (err) {
    console.error(err);
    els.error.hidden = false;
    if (!games.size) {
      for (const el of [els.bracket, els.calendar]) el.innerHTML = '<p class="empty-state">Schedule unavailable. Try again shortly.</p>';
    }
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
function showView(view) {
  if (view.type === 'series') {
    const s = series.get(view.id);
    if (!s) return false;
    renderSeriesDetail(els.detailBody, s);
  } else {
    const g = games.get(view.pk);
    if (!g) return false;
    renderDetail(els.detailBody, g);
    if (view.fromSeries) {
      els.detailBody.insertAdjacentHTML('afterbegin',
        `<button type="button" class="back-btn" data-series="${view.fromSeries}">← Back to series</button>`);
    }
  }
  openView = view;
  if (!els.detail.open) els.detail.showModal();
  return true;
}

// game cards carry data-pk, series boxes carry data-series
function viewFor(el) {
  if (el.dataset.series) return { type: 'series', id: el.dataset.series };
  return { type: 'game', pk: Number(el.dataset.pk), fromSeries: el.dataset.fromSeries };
}
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-pk], [data-series]');
  if (target) showView(viewFor(target));
  else if (e.target === els.detail) els.detail.close(); // backdrop click
});
document.addEventListener('keydown', (e) => {
  const card = e.target.closest?.('[role="button"][data-pk]');
  if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showView(viewFor(card)); }
});
els.detail.addEventListener('close', () => { openView = null; });

// ---- manual refresh -----------------------------------------------------------
const fullRefresh = () => load(() => fetchSchedule(season));
$('refresh-btn').addEventListener('click', fullRefresh);
$('retry-btn').addEventListener('click', fullRefresh);

document.body.classList.add('intro'); // entrance animations on first render only
const seedsReady = fetchSeeds(season).then((s) => { seeds = s; }).catch((err) => console.warn('No seeds:', err));
load(async () => { const list = await fetchSchedule(season); await seedsReady; return list; })
  .then(() => { showTab(); setTimeout(() => document.body.classList.remove('intro'), 1500); });
