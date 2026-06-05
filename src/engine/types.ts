export type PositionCode =
  | "POR"
  | "LD"
  | "LI"
  | "DFC"
  | "CAD"
  | "CAI"
  | "MCD"
  | "MC"
  | "MP"
  | "MD"
  | "MI"
  | "ED"
  | "EI"
  | "DC";

export type PositionGroup = "GK" | "DEF" | "MID" | "ATT";
export type PoolMode = "easy" | "hard";
export type VisibilityMode = "visible" | "hidden";

export interface SportingPlayer {
  playerId: string;
  shortName: string;
  fullName: string;
  season: string;
  division: "1" | "2";
  leaguePosition: number | null;
  positionCode: PositionCode;
  secondaryPositions: PositionCode[];
  positionGroup: PositionGroup;
  positionSource: string;
  age: number | null;
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  rating: number;
  sourceUrl: string;
}

export interface OpponentTeam {
  position: number;
  team: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  final_overall: number;
  attack_rating: number;
  defense_rating: number;
  best_xi: Array<{
    player_id: string;
    short_name: string;
    position_code: PositionCode;
    position_group: PositionGroup;
    minutes: number;
    rating: number;
  }>;
}

export interface Fixture {
  matchday: number;
  date: string;
  home_team: string;
  away_team: string;
  home_score_real: number | null;
  away_score_real: number | null;
  stadium: string;
  referee: string;
}

export interface GameData {
  meta: { name: string; generatedFrom: string[] };
  sportingPlayers: SportingPlayer[];
  opponents: OpponentTeam[];
  fixtures: Fixture[];
}

export interface Slot {
  id: string;
  position: PositionCode;
  x: number;
  y: number;
}

export interface Pick {
  slot: Slot;
  player: SportingPlayer;
  adjustedRating: number;
  positionPenalty: number;
}

export interface TeamStrength {
  overall: number;
  attack: number;
  defense: number;
}

export interface MatchResult {
  matchday: number;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
}

export interface TableRow {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface PlayoffTie {
  homeFirst: string;
  awayFirst: string;
  firstLeg: MatchResult;
  secondLeg: MatchResult;
  aggregate: string;
  winner: string;
  reason: "aggregate" | "league_position";
}

export interface SimulationResult {
  strength: TeamStrength;
  fixtures: MatchResult[];
  table: TableRow[];
  sportingPosition: number;
  outcome: "direct-promotion" | "playoff-promotion" | "playoff-elimination" | "no-promotion";
  playoff?: {
    semifinalA: PlayoffTie;
    semifinalB: PlayoffTie;
    final?: PlayoffTie;
  };
}
