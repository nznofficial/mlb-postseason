import { esc, gameTime, gameDayKey, localKey, teamLogo, inningLabel, statusBadge, roundClass, tvLine } from './format.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

function groupByDay(games) {
  const map = new Map();
  for (const g of [...games].sort((a, b) => a.date - b.date)) {
    const key = gameDayKey(g);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(g);
  }
  return map;
}

function teamLine(team, game) {
  const showScore = game.isFinal || game.isLive;
  const cls = game.isFinal ? (team.isWinner ? 'win' : 'loss') : '';
  return `<div class="team-line ${cls}">
    ${teamLogo(team, 18)}
    <span class="abbr">${esc(team.abbr)}</span>
    ${showScore ? `<span class="score">${team.score ?? 0}</span>` : ''}
  </div>`;
}

export function gameCard(game) {
  let foot;
  if (game.isFinal) {
    foot = `<span class="final">Final${game.linescore.inning > game.linescore.scheduled ? `/${game.linescore.inning}` : ''}</span>
            ${game.series ? `<span class="series">${esc(game.series)}</span>` : ''}`;
  } else if (game.isLive) {
    foot = `<span class="live-dot">LIVE</span> <span>${esc(inningLabel(game.linescore))}</span>`;
  } else {
    foot = `<span class="time">${esc(gameTime(game))}</span>`;
  }
  const tv = game.isFinal ? '' : `<div class="game-tv">${tvLine(game)}</div>`;

  return `<button type="button" class="game ${roundClass(game)} ${game.isLive ? 'is-live' : ''} ${game.ifNecessary && !game.isFinal ? 'if-nec' : ''}" data-pk="${game.pk}">
    <div class="game-head">
      <span class="round-tag">${esc(game.label)}</span>
      <span class="gnum">Game ${game.gameNumber ?? ''}</span>
      ${game.ifNecessary && !game.isFinal ? '<span class="ifnec">If nec.</span>' : ''}
      ${statusBadge(game)}
    </div>
    ${teamLine(game.away, game)}
    ${teamLine(game.home, game)}
    <div class="game-foot">${foot}</div>
    ${tv}
  </button>`;
}

/** Month grid limited to the weeks between `rangeStart` and `rangeEnd` (Sunday-aligned dates). */
function monthGrid(year, month, byDay, todayKey, rangeStart, rangeEnd) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const weeks = [];
  for (let sunday = new Date(year, month, 1 - first.getDay()); sunday <= last; sunday.setDate(sunday.getDate() + 7)) {
    if (sunday < rangeStart || sunday > rangeEnd) continue;
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
      if (date.getMonth() !== month) { cells.push('<div class="day empty"></div>'); continue; }
      const key = localKey(date);
      const games = byDay.get(key) || [];
      cells.push(`<div class="day ${games.length ? 'has-games' : ''} ${key === todayKey ? 'today' : ''}" data-day="${key}">
        <div class="day-num">${date.getDate()}</div>
        ${games.map(gameCard).join('')}
      </div>`);
    }
    weeks.push(cells.join(''));
  }
  return `<section class="month">
    <h2>${monthFmt.format(first)} <span class="year">${year}</span></h2>
    <div class="grid">
      ${WEEKDAYS.map((w) => `<div class="weekday">${w}</div>`).join('')}
      ${weeks.join('')}
    </div>
  </section>`;
}

function dayList(byDay, todayKey) {
  return `<div class="day-list">
    ${[...byDay.entries()].map(([key, games]) => `
      <section class="list-day ${key === todayKey ? 'today' : ''}" data-day="${key}">
        <h3>${dayFmt.format(parseKey(key))}${key === todayKey ? ' <span class="today-tag">Tonight</span>' : ''}</h3>
        <div class="list-games">${games.map(gameCard).join('')}</div>
      </section>`).join('')}
  </div>`;
}

/** Renders month grids (wide screens) and a day list (narrow screens); CSS picks which shows. */
export function renderCalendar(el, games) {
  if (!games.length) {
    el.innerHTML = '<p class="empty-state">No postseason games scheduled yet.</p>';
    return;
  }
  const byDay = groupByDay(games);
  const keys = [...byDay.keys()].sort();
  const start = parseKey(keys[0]);
  const end = parseKey(keys[keys.length - 1]);
  const todayKey = localKey(new Date());
  const rangeStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - start.getDay());
  const rangeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate() - end.getDay());

  const months = [];
  for (let y = start.getFullYear(), m = start.getMonth(); y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth()); m === 11 ? (y++, m = 0) : m++) {
    months.push(monthGrid(y, m, byDay, todayKey, rangeStart, rangeEnd));
  }
  el.innerHTML = `<div class="months">${months.join('')}</div>${dayList(byDay, todayKey)}`;
}

/** Scroll the current day (or the next game day) into view. */
export function scrollToToday(el) {
  const todayKey = localKey(new Date());
  const narrow = matchMedia('(max-width: 700px)').matches;
  const scope = el.querySelector(narrow ? '.day-list' : '.months');
  if (!scope) return;
  const days = [...scope.querySelectorAll('[data-day]')];
  const target = days.find((d) => d.dataset.day >= todayKey && (narrow || d.classList.contains('has-games') || d.dataset.day === todayKey));
  if (target && target !== days[0]) target.scrollIntoView({ block: narrow ? 'start' : 'center' });
}
