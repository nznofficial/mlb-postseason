import { esc, gameTime, teamLogo, inningLabel, roundClass, tvLine } from './format.js';

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const pad = (n) => String(n).padStart(2, '0');

function countdown(target) {
  const ms = target - Date.now();
  if (ms <= 0) return '<span class="cd-soon">First pitch soon</span>';
  const s = Math.floor(ms / 1000);
  const units = s >= 86400
    ? [[Math.floor(s / 86400), 'Days'], [Math.floor(s / 3600) % 24, 'Hrs'], [Math.floor(s / 60) % 60, 'Min']]
    : [[Math.floor(s / 3600), 'Hrs'], [Math.floor(s / 60) % 60, 'Min'], [s % 60, 'Sec']];
  return units.map(([v, l]) => `<span class="cd-unit"><b>${pad(v)}</b><i>${l}</i></span>`).join('<span class="cd-colon">:</span>');
}

function tick() {
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    el.innerHTML = countdown(Number(el.dataset.countdown));
  });
}
setInterval(tick, 1000);

const series = (g) => `${esc(g.description)}${g.gameNumber ? ` · Game ${g.gameNumber}` : ''}`;

function teamBlock(team, score) {
  return `<div class="nu-team">
    ${teamLogo(team, 44)}
    <span class="nu-abbr">${esc(team.abbr)}</span>
    ${score === undefined ? '' : `<span class="nu-score">${score ?? 0}</span>`}
  </div>`;
}

function liveCard(g, more) {
  return `<div class="nu-card is-live ${roundClass(g)}" data-pk="${g.pk}" role="button" tabindex="0">
      <div class="nu-label"><span class="nu-kicker live-dot">Live now</span><span class="nu-series">${series(g)}</span></div>
      <div class="nu-match">
        ${teamBlock(g.away, g.away.score)}
        <span class="nu-at">–</span>
        ${teamBlock(g.home, g.home.score)}
        <div class="nu-right nu-inning">${esc(inningLabel(g.linescore))}</div>
      </div>
      <div class="nu-meta">${g.series ? `<span>${esc(g.series)}</span>` : ''}${tvLine(g)}</div>
    </div>
    ${more ? `<a class="nu-more" href="#live">+${more} more live →</a>` : ''}`;
}

function nextCard(g) {
  const when = g.timeTBD
    ? '<span class="cd-soon">Time TBD</span>'
    : `<div class="countdown" data-countdown="${g.date.getTime()}">${countdown(g.date.getTime())}</div>`;
  const day = g.timeTBD ? new Date(`${g.officialDate}T12:00:00`) : g.date;
  return `<div class="nu-card ${roundClass(g)}" data-pk="${g.pk}" role="button" tabindex="0">
    <div class="nu-label"><span class="nu-kicker">Next up</span><span class="nu-series">${series(g)}</span></div>
    <div class="nu-match">
      ${teamBlock(g.away)}
      <span class="nu-at">@</span>
      ${teamBlock(g.home)}
      <div class="nu-right">${when}</div>
    </div>
    <div class="nu-meta"><span>${esc(dayFmt.format(day))} · ${esc(gameTime(g))}</span>${tvLine(g)}</div>
  </div>`;
}

function championCard(g) {
  const champ = g.home.isWinner ? g.home : g.away;
  return `<div class="nu-card round-ws" data-pk="${g.pk}" role="button" tabindex="0">
    <div class="nu-label"><span class="nu-kicker">World Series Champions</span></div>
    <div class="nu-match">${teamBlock(champ)}<span class="nu-champ">${esc(champ.name)}</span></div>
    ${g.series ? `<div class="nu-meta"><span>${esc(g.series)}</span></div>` : ''}
  </div>`;
}

/** Live game if one is on, otherwise the next scheduled game (or the champion once it's over). */
export function renderHero(el, games) {
  const live = games.filter((g) => g.isLive).sort((a, b) => a.date - b.date);
  if (live.length) { el.innerHTML = liveCard(live[0], live.length - 1); return; }

  const upcoming = games
    .filter((g) => !g.isFinal && !g.isPostponed)
    .sort((a, b) => a.officialDate.localeCompare(b.officialDate) || a.date - b.date);
  if (upcoming.length) { el.innerHTML = nextCard(upcoming[0]); return; }

  const wsFinal = games.filter((g) => g.type === 'W' && g.isFinal).sort((a, b) => b.date - a.date)[0];
  el.innerHTML = wsFinal?.series?.includes('wins') ? championCard(wsFinal) : '';
}
