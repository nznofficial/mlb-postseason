import { esc, gameTime, teamLogo, inningLabel } from './format.js';

const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

function lineScore(g) {
  const inns = g.linescore.innings;
  if (!inns.length) return '';
  const n = Math.max(g.linescore.scheduled, inns.length);
  const cols = Array.from({ length: n }, (_, i) => inns[i]);
  const row = (side) => {
    const team = g[side];
    const t = g.linescore.totals?.[side] || {};
    return `<tr class="${g.isFinal && team.isWinner ? 'win' : ''}">
      <th>${teamLogo(team, 16)} ${esc(team.abbr)}</th>
      ${cols.map((inn) => `<td>${inn?.[side]?.runs ?? (inn && g.isFinal && side === 'home' ? 'X' : '')}</td>`).join('')}
      <td class="tot">${t.runs ?? ''}</td><td class="tot">${t.hits ?? ''}</td><td class="tot">${t.errors ?? ''}</td>
    </tr>`;
  };
  return `<div class="linescore-wrap"><table class="linescore">
    <thead><tr><th></th>${cols.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>R</th><th>H</th><th>E</th></tr></thead>
    <tbody>${row('away')}${row('home')}</tbody>
  </table></div>`;
}

export function renderDetail(el, g) {
  let status;
  if (g.isFinal) status = `Final${g.linescore.inning > g.linescore.scheduled ? ` (${g.linescore.inning})` : ''}`;
  else if (g.isLive) status = `<span class="live-dot">LIVE</span> ${esc(inningLabel(g.linescore))}`;
  else status = esc(gameTime(g));

  const scoreOrVs = (g.isFinal || g.isLive)
    ? `<span class="big-score">${g.away.score ?? 0} – ${g.home.score ?? 0}</span>`
    : '<span class="vs">@</span>';

  const pitchers = g.isFinal
    ? [['W', g.decisions.win], ['L', g.decisions.loss], ['SV', g.decisions.save]].filter(([, v]) => v)
    : [[`${g.away.abbr} SP`, g.away.probable || 'TBD'], [`${g.home.abbr} SP`, g.home.probable || 'TBD']];

  const dateText = g.timeTBD
    ? dateFmt.format(new Date(`${g.officialDate}T12:00:00`))
    : dateFmt.format(g.date);

  el.innerHTML = `
    <p class="detail-round">${esc(g.description)}${g.gameNumber ? ` · Game ${g.gameNumber}` : ''}${g.ifNecessary && !g.isFinal ? ' · if necessary' : ''}</p>
    <div class="matchup-big">
      <div class="side">${teamLogo(g.away, 56)}<span>${esc(g.away.name)}</span></div>
      ${scoreOrVs}
      <div class="side">${teamLogo(g.home, 56)}<span>${esc(g.home.name)}</span></div>
    </div>
    <p class="detail-status">${status}</p>
    ${g.series ? `<p class="detail-series">${esc(g.series)}</p>` : ''}
    ${lineScore(g)}
    <dl class="facts">
      <div><dt>Date</dt><dd>${esc(dateText)}${g.timeTBD ? ' · time TBD' : ''}</dd></div>
      ${g.venue ? `<div><dt>Venue</dt><dd>${esc(g.venue)}</dd></div>` : ''}
      ${g.tv.english.length ? `<div><dt>TV</dt><dd>${esc(g.tv.english.join(', '))}</dd></div>` : ''}
      ${g.tv.spanish.length ? `<div><dt>Spanish</dt><dd>${esc(g.tv.spanish.join(', '))}</dd></div>` : ''}
      ${pitchers.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
    </dl>
    <p class="gameday"><a href="https://www.mlb.com/gameday/${g.pk}" target="_blank" rel="noopener">Open on MLB.com Gameday ↗</a></p>`;
}
