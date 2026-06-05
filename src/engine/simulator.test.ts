import { describe, expect, it } from "vitest";
import { formations } from "./formations";
import { makePick } from "./draft";
import { calculateStrength, simulateSeason, SPORTING } from "./simulator";
import type { Fixture, OpponentTeam, PositionCode, PositionGroup, SportingPlayer } from "./types";

const groups: Record<PositionCode, PositionGroup> = {
  POR: "GK",
  LD: "DEF",
  LI: "DEF",
  DFC: "DEF",
  CAD: "DEF",
  CAI: "DEF",
  MCD: "MID",
  MC: "MID",
  MP: "MID",
  MD: "MID",
  MI: "MID",
  ED: "ATT",
  EI: "ATT",
  DC: "ATT",
};

function player(positionCode: PositionCode, rating: number, index: number): SportingPlayer {
  return {
    playerId: `p-${index}`,
    shortName: `Player ${index}`,
    fullName: `Player ${index}`,
    season: "1984-85",
    division: "1",
    leaguePosition: 4,
    positionCode,
    secondaryPositions: [],
    positionGroup: groups[positionCode],
    positionSource: "test",
    age: 25,
    apps: 30,
    starts: 30,
    minutes: 2500,
    goals: positionCode === "DC" ? 15 : 1,
    rating,
    sourceUrl: "test",
  };
}

function mockPicks(rating = 78) {
  return formations["4-3-3"].map((slot, index) => makePick(player(slot.position, rating, index), slot));
}

function mockOpponents(): OpponentTeam[] {
  const names = [
    SPORTING,
    "Racing de Santander",
    "Deportivo de La Coruña",
    "Almería",
    "Málaga",
    "Las Palmas",
    "Castellón",
    "Burgos CF",
    "Eibar",
    "Córdoba",
    "AD Ceuta FC",
    "Albacete",
    "Andorra",
    "Granada",
    "Real Sociedad B",
    "Leganés",
    "Real Valladolid",
    "Cádiz",
    "Mirandés",
    "Huesca",
    "Cultural Leonesa",
    "Zaragoza",
  ];
  return names.map((team, index) => ({
    position: index + 1,
    team,
    points: 80 - index,
    played: 42,
    wins: 20,
    draws: 10,
    losses: 12,
    goals_for: 60,
    goals_against: 50,
    final_overall: Math.max(63, 80 - index),
    attack_rating: Math.max(61, 80 - index),
    defense_rating: Math.max(61, 80 - index),
    best_xi: [],
  }));
}

function mockFixtures(teams: OpponentTeam[]): Fixture[] {
  const fixtures: Fixture[] = [];
  let matchday = 1;
  for (let round = 0; round < 2; round += 1) {
    for (let i = 0; i < teams.length; i += 2) {
      const home = round === 0 ? teams[i].team : teams[i + 1].team;
      const away = round === 0 ? teams[i + 1].team : teams[i].team;
      fixtures.push({
        matchday,
        date: "01/01/2026",
        home_team: home,
        away_team: away,
        home_score_real: null,
        away_score_real: null,
        stadium: "Test",
        referee: "Test",
      });
    }
    matchday += 1;
  }
  // Repeat the two-round block until each team has 42 matches.
  const base = [...fixtures];
  while (fixtures.length < 462) {
    for (const fixture of base) {
      if (fixtures.length >= 462) break;
      fixtures.push({ ...fixture, matchday: (fixtures.length % 42) + 1 });
    }
  }
  return fixtures;
}

describe("simulator", () => {
  it("calculates team strength from the picked XI", () => {
    const strength = calculateStrength(mockPicks(80));
    expect(strength.overall).toBe(80);
    expect(strength.attack).toBeGreaterThan(0);
    expect(strength.defense).toBeGreaterThan(0);
  });

  it("simulates deterministically with the same seed", () => {
    const opponents = mockOpponents();
    const fixtures = mockFixtures(opponents);
    const picks = mockPicks(82);
    const first = simulateSeason(picks, opponents, fixtures, "seed-a");
    const second = simulateSeason(picks, opponents, fixtures, "seed-a");
    expect(first.table).toEqual(second.table);
    expect(first.fixtures).toEqual(second.fixtures);
  });

  it("produces a complete table", () => {
    const opponents = mockOpponents();
    const result = simulateSeason(mockPicks(78), opponents, mockFixtures(opponents), "seed-b");
    expect(result.table).toHaveLength(22);
    expect(result.table.every((row) => row.played === 42)).toBe(true);
    expect(result.sportingPosition).toBeGreaterThanOrEqual(1);
    expect(result.sportingPosition).toBeLessThanOrEqual(22);
  });

  it("keeps real non-Sporting scores anchored", () => {
    const opponents = mockOpponents();
    const fixtures: Fixture[] = [
      {
        matchday: 1,
        date: "01/01/2026",
        home_team: "Racing de Santander",
        away_team: "Deportivo de La Coruña",
        home_score_real: 4,
        away_score_real: 4,
        stadium: "Test",
        referee: "Test",
      },
      {
        matchday: 1,
        date: "01/01/2026",
        home_team: SPORTING,
        away_team: "Almería",
        home_score_real: null,
        away_score_real: null,
        stadium: "Test",
        referee: "Test",
      },
    ];
    const result = simulateSeason(mockPicks(78), opponents, fixtures, "seed-c");
    expect(result.fixtures[0]).toMatchObject({
      homeTeam: "Racing de Santander",
      awayTeam: "Deportivo de La Coruña",
      homeGoals: 4,
      awayGoals: 4,
    });
  });
});
