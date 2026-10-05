import { esc, gameTime, teamLogo, inningLabel, roundClass, tvLine } from './format.js';

function bases(b) {
  const on = (x) => (x ? 'on' : '');
  return `<svg class="bases" viewBox="0 0 60 44" aria-label="Runners on base">
    <rect class="base ${on(b.second)}" x="23" y="2" width="14" height="14" transform="rotate(45 30 9)"/>
    <rect class="base ${on(b.third)}" x="5" y="20" width="14" height="14" transform="rotate(45 12 27)"/>
    <rect class="base ${on(b.first)}" x="41" y="20" width="14" height="14" transform="rotate(45 48 27)"/>
  </svg>`;
}

function outs(n) {
  return `<span class="outs" aria-label="${n} outs">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
}

function liveRow(team) {
  return `<div class="live-team">
    ${teamLogo(team, 36)}
    <span class="name">${esc(team.short)}</span>
    <span class="runs">${team.score ?? 0}</span>
  </div>`;
}

function liveCard(g) {
  const ls = g.linescore;
  const midInning = ls.inningState === 'Middle' || ls.inningState === 'End';
  return `<article class="live-card ${roundClass(g)}" data-pk="${g.pk}" tabindex="0" role="button">
    <header>
      <span class="live-dot">LIVE</span>
      <span class="desc">${esc(g.description)}${g.gameNumber ? ` · Game ${g.gameNumber}` : ''}</span>
    </header>
    <div class="live-body">
      <div class="live-teams">${liveRow(g.away)}${liveRow(g.home)}</div>
      <div class="live-situation">
        <div class="inning">${esc(inningLabel(ls))}</div>
        ${midInning ? '' : `${bases(ls.bases)}
        <div class="count">${ls.balls}-${ls.strikes} ${outs(ls.outs)}</div>`}
      </div>
    </div>
    ${midInning ? '' : `<dl class="matchup">
      ${ls.pitcher ? `<div><dt>P</dt><dd>${esc(ls.pitcher)}</dd></div>` : ''}
      ${ls.batter ? `<div><dt>AB</dt><dd>${esc(ls.batter)}</dd></div>` : ''}
    </dl>`}
    <footer>
      ${g.series ? `<span>${esc(g.series)}</span>` : '<span></span>'}
      ${tvLine(g)}
    </footer>
  </article>`;
}

export function renderLive(el, games) {
  const live = games.filter((g) => g.isLive).sort((a, b) => a.date - b.date);
  if (live.length) {
    el.innerHTML = live.map(liveCard).join('');
    return live.length;
  }
  const next = games
    .filter((g) => !g.isFinal && !g.isPostponed && g.date > new Date() && g.away.real)
    .sort((a, b) => a.date - b.date)[0];
  el.innerHTML = `<div class="empty-state">
    <p class="big">No games live right now.</p>
    ${next ? `<p>Next up: <strong>${esc(next.away.short)} @ ${esc(next.home.short)}</strong>,
      ${esc(next.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))} at ${esc(gameTime(next))}
      ${next.tv.english.length ? ` on ${esc(next.tv.english.join(' · '))}` : ''}</p>` : ''}
  </div>`;
  return 0;
}
