import { TEAMS, isRealTeam } from './teams.js';

const BASE = 'https://statsapi.mlb.com/api/v1/schedule';
const GAME_TYPES = 'F,D,L,W'; // Wild Card, Division Series, LCS, World Series
const HYDRATE = 'broadcasts(all),linescore,team,seriesStatus,probablePitcher,decisions';

export const ROUNDS = { F: 'WC', D: 'DS', L: 'CS', W: 'WS' };

/** The postseason runs in the fall; before ~March, show last year's. */
export function currentSeason(now = new Date()) {
  return now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
}

async function getJSON(params) {
  const url = `${BASE}?${new URLSearchParams({ sportId: 1, gameType: GAME_TYPES, hydrate: HYDRATE, ...params })}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`MLB API ${res.status}`);
  const data = await res.json();
  return (data.dates || []).flatMap((d) => d.games.map(normalizeGame));
}

/** Every postseason game for the season. */
export const fetchSchedule = (season) => getJSON({ season });

/** Games from yesterday through today (US Eastern), used for live polling. */
export function fetchRecent() {
  const etDate = (offsetDays) => {
    const d = new Date(Date.now() + offsetDays * 864e5);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
  };
  return getJSON({ startDate: etDate(-1), endDate: etDate(0) });
}

/**
 * Playoff seeds (1–6 per league) from final regular-season standings:
 * division winners are seeded 1–3 by league rank, wild cards 4–6.
 * Returns Map teamId → seed.
 */
export async function fetchSeeds(season) {
  const url = `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB API ${res.status}`);
  const { records = [] } = await res.json();
  const seeds = new Map();
  for (const leagueId of [103, 104]) {
    const teams = records.filter((r) => r.league?.id === leagueId).flatMap((r) => r.teamRecords).filter((t) => t.clinched);
    const divWinners = teams.filter((t) => t.divisionChamp).sort((a, b) => a.leagueRank - b.leagueRank);
    const wildCards = teams.filter((t) => !t.divisionChamp && t.wildCardRank).sort((a, b) => a.wildCardRank - b.wildCardRank);
    [...divWinners.slice(0, 3), ...wildCards.slice(0, 3)].forEach((t, i) => seeds.set(t.team.id, i + 1));
  }
  return seeds;
}

function normalizeTeam(side) {
  const t = side.team || {};
  const real = isRealTeam(t.id);
  return {
    id: t.id,
    real,
    name: t.name || 'TBD',
    short: real ? t.teamName : t.name || 'TBD',
    abbr: real ? (t.abbreviation || TEAMS[t.id].abbr) : 'TBD',
    color: real ? TEAMS[t.id].color : '#888',
    score: side.score,
    isWinner: !!side.isWinner,
    probable: side.probablePitcher?.fullName || null,
  };
}

function normalizeBroadcasts(list = []) {
  const seen = new Set();
  const tv = [];
  for (const b of list) {
    if (b.type !== 'TV' || seen.has(b.name)) continue;
    seen.add(b.name);
    tv.push({ name: b.name, spanish: b.language === 'es' });
  }
  return { english: tv.filter((b) => !b.spanish).map((b) => b.name), spanish: tv.filter((b) => b.spanish).map((b) => b.name) };
}

/** Short series label, e.g. "NLDS", "AL WC", "WS". */
function seriesLabel(g) {
  const league = /^(AL|NL)\b/.exec(g.seriesStatus?.description || '')?.[1] || '';
  if (g.gameType === 'W') return 'WS';
  if (g.gameType === 'F') return `${league} WC`.trim();
  return `${league}${ROUNDS[g.gameType] || ''}`;
}

export function normalizeGame(g) {
  const ls = g.linescore || {};
  const state = g.status.abstractGameState; // Preview | Live | Final
  return {
    pk: g.gamePk,
    type: g.gameType,
    round: ROUNDS[g.gameType] || '',
    label: seriesLabel(g),
    seriesId: `${g.gameType}_${g.teams.away.seriesNumber}`, // e.g. D_1; matches MLB's postseason series ids
    description: g.seriesStatus?.description || g.seriesDescription, // e.g. "NL Division Series"
    seriesDescription: g.seriesDescription,
    gameNumber: g.seriesGameNumber,
    gamesInSeries: g.gamesInSeries,
    ifNecessary: g.ifNecessary === 'Y',
    date: new Date(g.gameDate),
    officialDate: g.officialDate,
    timeTBD: !!g.status.startTimeTBD,
    state,
    detailedState: g.status.detailedState,
    isLive: state === 'Live',
    isFinal: state === 'Final',
    isPostponed: /Postponed|Suspended|Cancelled/.test(g.status.detailedState),
    isDelayed: /Delay/.test(g.status.detailedState),
    away: normalizeTeam(g.teams.away),
    home: normalizeTeam(g.teams.home),
    venue: g.venue?.name,
    tv: normalizeBroadcasts(g.broadcasts),
    series: g.seriesStatus?.result || null,
    decisions: {
      win: g.decisions?.winner?.fullName,
      loss: g.decisions?.loser?.fullName,
      save: g.decisions?.save?.fullName,
    },
    linescore: {
      inning: ls.currentInning,
      inningOrdinal: ls.currentInningOrdinal,
      inningState: ls.inningState, // Top | Middle | Bottom | End
      isTop: ls.isTopInning,
      outs: ls.outs ?? 0,
      balls: ls.balls ?? 0,
      strikes: ls.strikes ?? 0,
      bases: { first: !!ls.offense?.first, second: !!ls.offense?.second, third: !!ls.offense?.third },
      batter: ls.offense?.batter?.fullName,
      pitcher: ls.defense?.pitcher?.fullName,
      innings: ls.innings || [],
      totals: ls.teams || null,
      scheduled: ls.scheduledInnings || 9,
    },
  };
}
