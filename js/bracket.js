import { esc, gameTime, localKey, teamLogo, inningLabel, tvLine } from './format.js';

/*
 * MLB numbers postseason series the same way every year:
 *   AL: Wild Card F_1 (3v6) & F_2 (4v5) → Division Series D_2 (vs 2 seed) & D_1 (vs 1 seed) → ALCS L_1
 *   NL: Wild Card F_3 (3v6) & F_4 (4v5) → Division Series D_4 (vs 2 seed) & D_3 (vs 1 seed) → NLCS L_2
 *   World Series W_1 = ALCS winner vs NLCS winner.
 * `feeds` lists which series send their winner into each slot (null = bye team in a DS).
 */
const TREE = {
  F_1: { league: 'AL', round: 'F', feeds: [] },
  F_2: { league: 'AL', round: 'F', feeds: [] },
  F_3: { league: 'NL', round: 'F', feeds: [] },
  F_4: { league: 'NL', round: 'F', feeds: [] },
  D_1: { league: 'AL', round: 'D', feeds: [null, 'F_2'] },
  D_2: { league: 'AL', round: 'D', feeds: [null, 'F_1'] },
  D_3: { league: 'NL', round: 'D', feeds: [null, 'F_4'] },
  D_4: { league: 'NL', round: 'D', feeds: [null, 'F_3'] },
  L_1: { league: 'AL', round: 'L', feeds: ['D_1', 'D_2'] },
  L_2: { league: 'NL', round: 'L', feeds: ['D_3', 'D_4'] },
  W_1: { league: '', round: 'W', feeds: ['L_1', 'L_2'] },
};
const ROUND_CLASS = { F: 'round-wc', D: 'round-ds', L: 'round-cs', W: 'round-ws' };
const ROUND_NAME = { F: 'Wild Card', D: 'Division Series', L: 'Championship Series', W: 'World Series' };

const shortDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function label(id, short = false) {
  const { league, round } = TREE[id];
  return { F: `${league} ${short ? 'WC' : 'Wild Card'}`, D: `${league}DS`, L: `${league}CS`, W: 'World Series' }[round];
}

function dayWord(g) {
  const key = g.timeTBD ? g.officialDate : localKey(g.date);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (key === localKey(today)) return g.timeTBD || g.date.getHours() >= 17 ? 'Tonight' : 'Today';
  if (key === localKey(tomorrow)) return 'Tomorrow';
  return shortDay.format(g.timeTBD ? new Date(`${g.officialDate}T12:00:00`) : g.date);
}

/** Group games into series and work out wins, winner, live game and next game. */
function buildSeries(games, seeds) {
  const byId = new Map(Object.keys(TREE).map((id) => [id, []]));
  for (const g of games) byId.get(g.seriesId)?.push(g);

  const series = new Map();
  for (const [id, list] of byId) {
    list.sort((a, b) => (a.gameNumber ?? 0) - (b.gameNumber ?? 0));
    const teams = new Map(); // real teams that appear in this series' games
    const wins = new Map();
    for (const g of list) {
      for (const t of [g.away, g.home]) if (t.real) teams.set(t.id, t);
      if (g.isFinal) {
        const w = g.home.isWinner ? g.home : g.away.isWinner ? g.away : null;
        if (w?.real) wins.set(w.id, (wins.get(w.id) || 0) + 1);
      }
    }
    const bestOf = list[0]?.gamesInSeries || { F: 3, D: 5, L: 7, W: 7 }[TREE[id].round];
    const need = Math.floor(bestOf / 2) + 1;
    const winnerId = [...wins].find(([, n]) => n >= need)?.[0];
    series.set(id, {
      id, ...TREE[id], games: list, teams, wins, bestOf,
      winner: winnerId ? teams.get(winnerId) : null,
      live: list.find((g) => g.isLive) || null,
      next: list.find((g) => !g.isFinal && !g.isLive && !g.isPostponed) || null,
      started: list.some((g) => g.isFinal || g.isLive),
    });
  }

  // Resolve the two bracket slots for each series, in feeder order so the lines make sense.
  const slot = (team) => ({ team, seed: team ? seeds.get(team.id) : undefined });
  const placeholder = (feederId) => {
    const f = series.get(feederId);
    const names = f.slots?.map((s) => s.team?.abbr).filter(Boolean);
    return names?.length === 2 ? names.join(' / ') : `${label(feederId)} winner`;
  };
  for (const id of ['F_1', 'F_2', 'F_3', 'F_4', 'D_1', 'D_2', 'D_3', 'D_4', 'L_1', 'L_2', 'W_1']) {
    const s = series.get(id);
    if (s.round === 'F') {
      s.slots = [...s.teams.values()].sort((a, b) => (seeds.get(a.id) ?? 9) - (seeds.get(b.id) ?? 9)).map(slot);
    } else {
      const feederTeams = (fid) => new Set(series.get(fid).slots.map((x) => x.team?.id).filter(Boolean));
      s.slots = s.feeds.map((fid) => {
        if (fid === null) { // bye team: the DS team that didn't come out of the Wild Card
          const wc = feederTeams(s.feeds[1]);
          const bye = [...s.teams.values()].find((t) => !wc.has(t.id));
          return bye ? slot(bye) : { team: null, placeholder: `${s.league} ${['D_1', 'D_3'].includes(id) ? 1 : 2} seed` };
        }
        const f = series.get(fid);
        const fromGames = [...s.teams.values()].find((t) => feederTeams(fid).has(t.id));
        const team = f.winner || fromGames || null;
        return { ...slot(team), placeholder: team ? null : placeholder(fid) };
      });
    }
    while (s.slots.length < 2) s.slots.push({ team: null, placeholder: 'TBD' });
  }
  return series;
}

function statusLines(s) {
  const [a, b] = s.slots.map((x) => x.team);
  const w = (t) => (t ? s.wins.get(t.id) || 0 : 0);
  if (s.winner) {
    const loser = s.winner === a ? b : a;
    return [`<span class="s-result">${esc(s.winner.abbr)} wins ${w(s.winner)}-${w(loser)}</span>`, ''];
  }
  let first = '';
  if (s.started && a && b) {
    first = w(a) === w(b) ? `Series tied ${w(a)}-${w(b)}`
      : `${esc((w(a) > w(b) ? a : b).abbr)} leads ${Math.max(w(a), w(b))}-${Math.min(w(a), w(b))}`;
  }
  let second = '';
  if (s.live) {
    second = `<span class="live-dot">Live</span> G${s.live.gameNumber} · ${esc(inningLabel(s.live.linescore))}`;
  } else if (s.next) {
    const g = s.next;
    // time zone in its own span so the wide bracket can hide it (the nav bar shows it)
    const time = g.timeTBD ? '' : ` ${esc(gameTime(g)).replace(/ (\S+)$/, ' <span class="tz">$1</span>')}`;
    second = `G${g.gameNumber} · ${esc(dayWord(g))}${time}`;
  }
  return [first, second];
}

function slotRow(s, x) {
  const t = x.team;
  const cls = s.winner ? (t && t === s.winner ? 'win' : 'out') : '';
  const wins = s.started && t ? `<span class="s-wins">${s.wins.get(t.id) || 0}</span>` : '';
  return `<div class="slot ${cls}">
    <span class="seed">${x.seed ?? ''}</span>
    ${t ? teamLogo(t, 22) : teamLogo({ real: false }, 22)}
    <span class="s-abbr ${t ? '' : 'tbd'}">${esc(t ? t.abbr : x.placeholder)}</span>
    ${wins}
  </div>`;
}

function seriesBox(s) {
  const [line1, line2] = statusLines(s);
  const tv = s.live || s.next;
  return `<button type="button" class="series ${ROUND_CLASS[s.round]} ${s.live ? 'is-live' : ''} ${s.winner ? 'is-done' : ''}" data-series="${s.id}">
    <div class="s-head"><span class="round-tag">${esc(label(s.id, true))}</span><span class="s-best">Best of ${s.bestOf}</span></div>
    ${s.slots.map((x) => slotRow(s, x)).join('')}
    ${line1 || line2 ? `<div class="s-status">${line1 ? `<div>${line1}</div>` : ''}${line2 ? `<div class="s-next">${line2}</div>` : ''}</div>` : ''}
    ${tv && !s.winner ? `<div class="s-tv">${tvLine(tv)}</div>` : ''}
  </button>`;
}

function column(title, ids, series, extra = '') {
  return `<div class="b-col ${extra}">
    <div class="b-col-head">${title}</div>
    <div class="b-col-body">${ids.map((id) => seriesBox(series.get(id))).join('')}</div>
  </div>`;
}

function champion(series) {
  const ws = series.get('W_1');
  return ws.winner
    ? `<div class="champ">${teamLogo(ws.winner, 56)}<span class="champ-kicker">World Series Champions</span><span class="champ-name">${esc(ws.winner.name)}</span></div>`
    : '';
}

// Connector lines: [from, to, slot index in `to`]
const LINKS = [
  ['F_2', 'D_1', 1], ['F_1', 'D_2', 1], ['D_1', 'L_1', 0], ['D_2', 'L_1', 1], ['L_1', 'W_1', 0],
  ['F_4', 'D_3', 1], ['F_3', 'D_4', 1], ['D_3', 'L_2', 0], ['D_4', 'L_2', 1], ['L_2', 'W_1', 1],
];

function drawLines(root, series) {
  const svg = root.querySelector('.b-lines');
  const base = root.getBoundingClientRect();
  if (!svg || !base.width) return;
  svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
  svg.innerHTML = LINKS.map(([from, to, idx]) => {
    const a = root.querySelector(`.b-grid [data-series="${from}"]`)?.getBoundingClientRect();
    const toEl = root.querySelector(`.b-grid [data-series="${to}"]`);
    const b = toEl?.querySelectorAll('.slot')[idx]?.getBoundingClientRect();
    if (!a || !b) return '';
    const leftToRight = a.right <= b.left;
    const x1 = (leftToRight ? a.right : a.left) - base.left;
    const x2 = (leftToRight ? b.left : b.right) - base.left;
    const y1 = a.top + a.height / 2 - base.top;
    const y2 = b.top + b.height / 2 - base.top;
    const xm = (x1 + x2) / 2;
    const done = series.get(from).winner ? 'done' : '';
    return `<path class="${done}" d="M${x1} ${y1} H${xm} V${y2} H${x2}"/>`;
  }).join('');
}

let observer;

/** Converging bracket on wide screens; stacked rounds on narrow screens (CSS picks which). */
export function renderBracket(el, games, seeds) {
  const series = buildSeries(games, seeds);
  if (![...series.values()].some((s) => s.games.length)) {
    el.innerHTML = '<p class="empty-state">The bracket appears once the postseason is set.</p>';
    return series;
  }

  const wide = `<div class="b-wide">
    <svg class="b-lines" aria-hidden="true"></svg>
    <div class="b-grid">
      ${column('Wild Card', ['F_2', 'F_1'], series, 'al')}
      ${column('Division Series', ['D_1', 'D_2'], series, 'al')}
      ${column('ALCS', ['L_1'], series, 'al')}
      <div class="b-col ws-col">
        <div class="b-col-head">World Series</div>
        <div class="b-col-body">${champion(series)}${seriesBox(series.get('W_1'))}</div>
      </div>
      ${column('NLCS', ['L_2'], series, 'nl')}
      ${column('Division Series', ['D_3', 'D_4'], series, 'nl')}
      ${column('Wild Card', ['F_4', 'F_3'], series, 'nl')}
    </div>
    <div class="b-leagues"><span>American League</span><span>National League</span></div>
  </div>`;

  const rounds = [
    ['W', ['W_1']], ['L', ['L_1', 'L_2']], ['D', ['D_1', 'D_2', 'D_3', 'D_4']], ['F', ['F_2', 'F_1', 'F_4', 'F_3']],
  ];
  const stacked = `<div class="b-stacked">
    ${champion(series)}
    ${rounds.map(([r, ids]) => `<section class="b-round">
      <h3>${ROUND_NAME[r]}</h3>
      <div class="b-round-grid ${ids.length === 1 ? 'single' : ''}">${ids.map((id) => seriesBox(series.get(id))).join('')}</div>
    </section>`).join('')}
  </div>`;

  el.innerHTML = wide + stacked;
  const root = el.querySelector('.b-wide');
  drawLines(root, series);
  observer?.disconnect();
  observer = new ResizeObserver(() => drawLines(root, series)); // also fires when the tab becomes visible
  observer.observe(root);
  return series;
}

/** Series panel: matchup, series score and every game. */
export function renderSeriesDetail(el, s) {
  const [a, b] = s.slots;
  const side = (x) => `<div class="side">${x.team ? teamLogo(x.team, 56) : teamLogo({ real: false }, 56)}<span>${esc(x.team ? x.team.name : x.placeholder)}</span>${x.seed ? `<span class="side-seed">${x.seed} seed</span>` : ''}</div>`;
  const w = (x) => (x.team ? s.wins.get(x.team.id) || 0 : 0);
  const [line1, line2] = statusLines(s);

  const rows = s.games.map((g) => {
    const day = g.timeTBD ? new Date(`${g.officialDate}T12:00:00`) : g.date;
    let main, status;
    if (g.isFinal || g.isLive) {
      main = `<span class="${g.isFinal && g.away.isWinner ? 'w' : ''}">${esc(g.away.abbr)} ${g.away.score ?? 0}</span>
              <span class="dash">–</span>
              <span class="${g.isFinal && g.home.isWinner ? 'w' : ''}">${g.home.score ?? 0} ${esc(g.home.abbr)}</span>`;
      status = g.isLive ? `<span class="live-dot">Live</span> ${esc(inningLabel(g.linescore))}`
        : `Final${g.linescore.inning > g.linescore.scheduled ? `/${g.linescore.inning}` : ''}`;
    } else {
      main = `${esc(g.away.abbr)} <span class="dash">@</span> ${esc(g.home.abbr)}`;
      status = `${esc(gameTime(g))}${g.ifNecessary ? ' · <i>if nec.</i>' : ''}`;
    }
    return `<li><button type="button" class="sg-row ${g.isLive ? 'is-live' : ''} ${g.ifNecessary && !g.isFinal ? 'if-nec' : ''}" data-pk="${g.pk}" data-from-series="${s.id}">
      <span class="sg-num">G${g.gameNumber}</span>
      <span class="sg-date">${esc(shortDay.format(day))}</span>
      <span class="sg-main">${main}</span>
      <span class="sg-status">${status}</span>
      ${!g.isFinal ? `<span class="sg-tv">${tvLine(g)}</span>` : ''}
    </button></li>`;
  }).join('');

  el.innerHTML = `
    <p class="detail-round">${esc(label(s.id))} · Best of ${s.bestOf}</p>
    <div class="matchup-big">
      ${side(a)}
      ${s.started ? `<span class="big-score">${w(a)} – ${w(b)}</span>` : '<span class="vs">vs</span>'}
      ${side(b)}
    </div>
    ${line1 ? `<p class="detail-status">${line1}</p>` : ''}
    ${line2 ? `<p class="detail-series">${line2}</p>` : ''}
    ${rows ? `<ol class="series-games">${rows}</ol>` : '<p class="detail-series">Schedule to be announced.</p>'}`;
}
