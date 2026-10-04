// MLB team id → abbreviation and primary color.
export const TEAMS = {
  108: { abbr: 'LAA', color: '#BA0021' },
  109: { abbr: 'AZ',  color: '#A71930' },
  110: { abbr: 'BAL', color: '#DF4601' },
  111: { abbr: 'BOS', color: '#BD3039' },
  112: { abbr: 'CHC', color: '#0E3386' },
  113: { abbr: 'CIN', color: '#C6011F' },
  114: { abbr: 'CLE', color: '#00385D' },
  115: { abbr: 'COL', color: '#33006F' },
  116: { abbr: 'DET', color: '#0C2340' },
  117: { abbr: 'HOU', color: '#EB6E1F' },
  118: { abbr: 'KC',  color: '#004687' },
  119: { abbr: 'LAD', color: '#005A9C' },
  120: { abbr: 'WSH', color: '#AB0003' },
  121: { abbr: 'NYM', color: '#FF5910' },
  133: { abbr: 'ATH', color: '#003831' },
  134: { abbr: 'PIT', color: '#FDB827' },
  135: { abbr: 'SD',  color: '#2F241D' },
  136: { abbr: 'SEA', color: '#005C5C' },
  137: { abbr: 'SF',  color: '#FD5A1E' },
  138: { abbr: 'STL', color: '#C41E3A' },
  139: { abbr: 'TB',  color: '#092C5C' },
  140: { abbr: 'TEX', color: '#003278' },
  141: { abbr: 'TOR', color: '#134A8E' },
  142: { abbr: 'MIN', color: '#002B5C' },
  143: { abbr: 'PHI', color: '#E81828' },
  144: { abbr: 'ATL', color: '#CE1141' },
  145: { abbr: 'CWS', color: '#27251F' },
  146: { abbr: 'MIA', color: '#00A3E0' },
  147: { abbr: 'NYY', color: '#0C2340' },
  158: { abbr: 'MIL', color: '#12284B' },
};

export const isRealTeam = (id) => id in TEAMS;
export const logoUrl = (id) => `https://www.mlbstatic.com/team-logos/team-cap-on-light/${id}.svg`;
export const darkLogoUrl = (id) => `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${id}.svg`;
