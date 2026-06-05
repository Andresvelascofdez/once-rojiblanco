import type {
  Fixture,
  MatchResult,
  OpponentTeam,
  Pick,
  PlayoffTie,
  SimulationResult,
  TableRow,
  TeamStrength,
} from "./types";
import { createRng, poisson } from "./random";

export const SPORTING = "Sporting de Gijón";

const MATCH_MODEL = {
  baseGoals: 1.2,
  homeAdvantage: 0.32,
  maxRatingGoalSwing: 0.65,
  ratingScale: 14,
  minExpectedGoals: 0.15,
  maxExpectedGoals: 3.3,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateStrength(picks: Pick[]): TeamStrength {
  if (picks.length !== 11) {
    return { overall: 0, attack: 0, defense: 0 };
  }
  const ratings = picks.map((pick) => pick.adjustedRating);
  const overall = Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length);

  const attackWeights = picks.map((pick) => {
    const pos = pick.slot.position;
    if (["DC", "ED", "EI"].includes(pos)) return 1;
    if (["MP", "MC", "MD", "MI", "MCD"].includes(pos)) return 0.45;
    if (["LD", "LI", "CAD", "CAI"].includes(pos)) return 0.1;
    return 0;
  });
  const defenseWeights = picks.map((pick) => {
    const pos = pick.slot.position;
    if (pos === "POR" || ["DFC", "LD", "LI", "CAD", "CAI"].includes(pos)) return 1;
    if (["MCD", "MC"].includes(pos)) return 0.45;
    if (["MD", "MI"].includes(pos)) return 0.2;
    return 0;
  });

  const weighted = (weights: number[]) => {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (!totalWeight) return overall;
    return Math.round(
      picks.reduce((sum, pick, index) => sum + pick.adjustedRating * weights[index], 0) / totalWeight,
    );
  };

  return {
    overall,
    attack: weighted(attackWeights),
    defense: weighted(defenseWeights),
  };
}

function teamStrength(team: string, userStrength: TeamStrength, opponents: OpponentTeam[]): TeamStrength {
  if (team === SPORTING) return userStrength;
  const opponent = opponents.find((item) => item.team === team);
  if (!opponent) {
    return { overall: 68, attack: 68, defense: 68 };
  }
  return {
    overall: opponent.final_overall,
    attack: opponent.attack_rating,
    defense: opponent.defense_rating,
  };
}

export function simulateMatch(
  matchday: number,
  homeTeam: string,
  awayTeam: string,
  home: TeamStrength,
  away: TeamStrength,
  rng: () => number,
): MatchResult {
  const goalSwing = (ratingEdge: number) =>
    Math.tanh(ratingEdge / MATCH_MODEL.ratingScale) * MATCH_MODEL.maxRatingGoalSwing;
  const homeLambda = clamp(
    MATCH_MODEL.baseGoals + MATCH_MODEL.homeAdvantage + goalSwing(home.attack - away.defense),
    MATCH_MODEL.minExpectedGoals,
    MATCH_MODEL.maxExpectedGoals,
  );
  const awayLambda = clamp(
    MATCH_MODEL.baseGoals + goalSwing(away.attack - home.defense),
    MATCH_MODEL.minExpectedGoals,
    MATCH_MODEL.maxExpectedGoals,
  );
  return {
    matchday,
    homeTeam,
    awayTeam,
    homeGoals: poisson(homeLambda, rng),
    awayGoals: poisson(awayLambda, rng),
  };
}

function isSportingFixture(fixture: Fixture): boolean {
  return fixture.home_team === SPORTING || fixture.away_team === SPORTING;
}

function hasRealScore(fixture: Fixture): boolean {
  return fixture.home_score_real !== null && fixture.away_score_real !== null;
}

function realMatchResult(fixture: Fixture): MatchResult {
  return {
    matchday: fixture.matchday,
    homeTeam: fixture.home_team,
    awayTeam: fixture.away_team,
    homeGoals: fixture.home_score_real!,
    awayGoals: fixture.away_score_real!,
  };
}

function emptyRow(team: string): TableRow {
  return {
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

export function buildTable(results: MatchResult[], teams: string[]): TableRow[] {
  const table = new Map<string, TableRow>();
  teams.forEach((team) => table.set(team, emptyRow(team)));
  for (const result of results) {
    const home = table.get(result.homeTeam) ?? emptyRow(result.homeTeam);
    const away = table.get(result.awayTeam) ?? emptyRow(result.awayTeam);
    home.played += 1;
    away.played += 1;
    home.goalsFor += result.homeGoals;
    home.goalsAgainst += result.awayGoals;
    away.goalsFor += result.awayGoals;
    away.goalsAgainst += result.homeGoals;
    if (result.homeGoals > result.awayGoals) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (result.homeGoals < result.awayGoals) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
    table.set(home.team, home);
    table.set(away.team, away);
  }
  return [...table.values()]
    .map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.team.localeCompare(b.team),
    );
}

function leaguePosition(table: TableRow[], team: string): number {
  return table.findIndex((row) => row.team === team) + 1;
}

function betterLeagueTeam(a: string, b: string, table: TableRow[]): string {
  return leaguePosition(table, a) < leaguePosition(table, b) ? a : b;
}

function simulateTie(
  firstHome: string,
  firstAway: string,
  table: TableRow[],
  strengths: Map<string, TeamStrength>,
  rng: () => number,
  phaseOffset: number,
): PlayoffTie {
  const firstLeg = simulateMatch(
    100 + phaseOffset,
    firstHome,
    firstAway,
    strengths.get(firstHome)!,
    strengths.get(firstAway)!,
    rng,
  );
  const secondLeg = simulateMatch(
    101 + phaseOffset,
    firstAway,
    firstHome,
    strengths.get(firstAway)!,
    strengths.get(firstHome)!,
    rng,
  );
  const firstAggregate = firstLeg.homeGoals + secondLeg.awayGoals;
  const secondAggregate = firstLeg.awayGoals + secondLeg.homeGoals;
  let winner: string;
  let reason: PlayoffTie["reason"];
  if (firstAggregate > secondAggregate) {
    winner = firstHome;
    reason = "aggregate";
  } else if (secondAggregate > firstAggregate) {
    winner = firstAway;
    reason = "aggregate";
  } else {
    winner = betterLeagueTeam(firstHome, firstAway, table);
    reason = "league_position";
  }
  return {
    homeFirst: firstHome,
    awayFirst: firstAway,
    firstLeg,
    secondLeg,
    aggregate: `${firstAggregate}-${secondAggregate}`,
    winner,
    reason,
  };
}

export function simulateSeason(
  picks: Pick[],
  opponents: OpponentTeam[],
  fixtures: Fixture[],
  seed = "once-rojiblanco",
): SimulationResult {
  const rng = createRng(seed);
  const strength = calculateStrength(picks);
  const teams = opponents.map((team) => team.team);
  const results = fixtures.map((fixture) => {
    if (!isSportingFixture(fixture) && hasRealScore(fixture)) {
      return realMatchResult(fixture);
    }
    return simulateMatch(
      fixture.matchday,
      fixture.home_team,
      fixture.away_team,
      teamStrength(fixture.home_team, strength, opponents),
      teamStrength(fixture.away_team, strength, opponents),
      rng,
    );
  });
  const table = buildTable(results, teams);
  const sportingPosition = leaguePosition(table, SPORTING);

  const strengths = new Map<string, TeamStrength>();
  for (const team of opponents) {
    strengths.set(team.team, teamStrength(team.team, strength, opponents));
  }
  strengths.set(SPORTING, strength);

  if (sportingPosition <= 2) {
    return { strength, fixtures: results, table, sportingPosition, outcome: "direct-promotion" };
  }
  if (sportingPosition > 6) {
    return { strength, fixtures: results, table, sportingPosition, outcome: "no-promotion" };
  }

  const playoffTeams = table.slice(2, 6).map((row) => row.team);
  const third = playoffTeams[0];
  const fourth = playoffTeams[1];
  const fifth = playoffTeams[2];
  const sixth = playoffTeams[3];
  const semifinalA = simulateTie(sixth, third, table, strengths, rng, 1);
  const semifinalB = simulateTie(fifth, fourth, table, strengths, rng, 3);
  const finalFirstHome = betterLeagueTeam(semifinalA.winner, semifinalB.winner, table) === semifinalA.winner
    ? semifinalB.winner
    : semifinalA.winner;
  const finalFirstAway = finalFirstHome === semifinalA.winner ? semifinalB.winner : semifinalA.winner;
  const final = simulateTie(finalFirstHome, finalFirstAway, table, strengths, rng, 5);
  const outcome = final.winner === SPORTING ? "playoff-promotion" : "playoff-elimination";
  return {
    strength,
    fixtures: results,
    table,
    sportingPosition,
    outcome,
    playoff: { semifinalA, semifinalB, final },
  };
}
