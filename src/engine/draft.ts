import { formations } from "./formations";
import { adjustedRating, canPlay, positionPenalty } from "./positions";
import { createRng, pickRandom } from "./random";
import type { Pick, PoolMode, Slot, SportingPlayer } from "./types";

const MIN_BALANCED_SEASON = 1980;

function seasonStartYear(season: string): number {
  return Number.parseInt(season.slice(0, 4), 10);
}

function orderScore(player: SportingPlayer, seed: string): number {
  const rng = createRng(`${seed}:${player.season}:${player.playerId}:${player.positionCode}`);
  return rng();
}

export function poolPlayers(players: SportingPlayer[], mode: PoolMode): SportingPlayer[] {
  return players.filter((player) => {
    if (seasonStartYear(player.season) < MIN_BALANCED_SEASON) return false;
    return mode === "easy" ? ["1", "2"].includes(player.division) : player.division === "2";
  });
}

export function seasonsForPool(players: SportingPlayer[], mode: PoolMode): string[] {
  return [...new Set(poolPlayers(players, mode).map((player) => player.season))].sort();
}

export function usedPlayerIds(picks: Array<Pick | null>): Set<string> {
  return new Set(picks.filter(Boolean).map((pick) => pick!.player.playerId));
}

export function compatibleSlots(player: SportingPlayer, picks: Array<Pick | null>, formationName: string): number[] {
  const slots = formations[formationName];
  return slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot, index }) => !picks[index] && canPlay(player, slot))
    .map(({ index }) => index);
}

export function availablePlayersForSeason(
  players: SportingPlayer[],
  season: string,
  mode: PoolMode,
  picks: Array<Pick | null>,
  formationName: string,
  orderSeed = "once-rojiblanco",
): SportingPlayer[] {
  const used = usedPlayerIds(picks);
  return poolPlayers(players, mode)
    .filter((player) => player.season === season && !used.has(player.playerId))
    .filter((player) => compatibleSlots(player, picks, formationName).length > 0)
    .sort((a, b) => orderScore(a, orderSeed) - orderScore(b, orderSeed));
}

export function rollSeason(
  players: SportingPlayer[],
  mode: PoolMode,
  picks: Array<Pick | null>,
  formationName: string,
  seed: string,
): string | null {
  const rng = createRng(seed);
  const seasons = seasonsForPool(players, mode).filter(
    (season) => availablePlayersForSeason(players, season, mode, picks, formationName).length > 0,
  );
  if (!seasons.length) return null;
  return pickRandom(seasons, rng);
}

export function makePick(player: SportingPlayer, slot: Slot): Pick {
  const penalty = positionPenalty(player, slot);
  if (penalty === null) {
    throw new Error(`${player.shortName} cannot play ${slot.position}`);
  }
  return {
    player,
    slot,
    positionPenalty: penalty,
    adjustedRating: adjustedRating(player, slot),
  };
}

export function createEmptyPicks(formationName: string): Array<Pick | null> {
  return formations[formationName].map(() => null);
}

export function completedPicks(picks: Array<Pick | null>): Pick[] {
  return picks.filter((pick): pick is Pick => Boolean(pick));
}
