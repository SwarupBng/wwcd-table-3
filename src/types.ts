export type Game = 'BGMI' | 'PUBG';
export type EntryMode = 'rank' | 'points';
export type TiebreakKey = 'wwcd' | 'finish' | 'reachedFirst' | 'placement';
export type ThemeId = 'amaze' | 'bmic' | 'india';
export type LogoMode = 'initials' | 'upload' | 'none';

export interface Team {
  id: string;
  name: string;
  /** slot number in the lobby; helps the admin enter data, never shown on the tables */
  slot: number;
  logoMode: LogoMode;
  /** data URL, used when logoMode is 'upload' */
  logo?: string;
}

export interface TeamResult {
  teamId: string;
  /** finishing rank in the match (rank entry mode), otherwise null */
  placement: number | null;
  placementPoints: number;
  finishPoints: number;
  /** chicken dinner */
  wwcd: boolean;
}

export interface Match {
  /** position in the whole tournament, starting at 0 */
  index: number;
  /** 1-based day */
  day: number;
  /** 1-based number inside the day */
  number: number;
  map: string;
  results: TeamResult[] | null;
}

export interface Preset {
  /** placementPoints[0] is the points for 1st place, and so on */
  placementPoints: number[];
  /** points per finish */
  finishValue: number;
}

export interface SmashSettings {
  enabled: boolean;
  /** the day the smash rule starts applying (default 3) */
  startDay: number;
  /** points added to the previous day's leader to get the threshold */
  extraPoints: number;
}

export interface Tournament {
  id: string;
  name: string;
  game: Game;
  days: number;
  matchesPerDay: number;
  /** players in each match lobby; total finishes in a match can be at most this minus 1 */
  lobbyPlayers: number;
  entryMode: EntryMode;
  preset: Preset;
  tiebreakers: TiebreakKey[];
  smash: SmashSettings;
  teams: Team[];
  matches: Match[];
  theme: ThemeId;
  logo?: string;
  organizerLogo?: string;
  footerText: string;
  createdAt: string;
  updatedAt: string;
}
