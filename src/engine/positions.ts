import type { PositionCode, PositionGroup, Slot, SportingPlayer } from "./types";

export const positionLabels: Record<PositionCode, string> = {
  POR: "POR",
  LD: "LD",
  LI: "LI",
  DFC: "DFC",
  CAD: "CAD",
  CAI: "CAI",
  MCD: "MCD",
  MC: "MC",
  MP: "MP",
  MD: "MD",
  MI: "MI",
  ED: "ED",
  EI: "EI",
  DC: "DC",
};

export const positionGroups: Record<PositionCode, PositionGroup> = {
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

const compatibility: Record<PositionCode, PositionCode[]> = {
  POR: ["POR"],
  LD: ["LD", "CAD"],
  LI: ["LI", "CAI"],
  DFC: ["DFC"],
  CAD: ["CAD", "LD", "MD"],
  CAI: ["CAI", "LI", "MI"],
  MCD: ["MCD", "MC"],
  MC: ["MC", "MCD", "MP"],
  MP: ["MP", "MC", "DC"],
  MD: ["MD", "ED", "MC"],
  MI: ["MI", "EI", "MC"],
  ED: ["ED", "MD"],
  EI: ["EI", "MI"],
  DC: ["DC", "MP"],
};

export function positionPenaltyForCode(playerPosition: PositionCode, slotPosition: PositionCode): number | null {
  if (playerPosition === slotPosition) return 0;
  const allowed = compatibility[slotPosition] ?? [];
  if (!allowed.includes(playerPosition)) return null;
  if (positionGroups[playerPosition] === positionGroups[slotPosition]) return -1;
  return -3;
}

export function positionPenalty(player: SportingPlayer, slot: Slot): number | null {
  const primaryPenalty = positionPenaltyForCode(player.positionCode, slot.position);
  const secondaryPenalties = (player.secondaryPositions ?? [])
    .map((position) => positionPenaltyForCode(position, slot.position))
    .filter((penalty): penalty is number => penalty !== null)
    .map((penalty) => penalty - 2);
  const candidates = [
    ...(primaryPenalty === null ? [] : [primaryPenalty]),
    ...secondaryPenalties,
  ];
  return candidates.length ? Math.max(...candidates) : null;
}

export function canPlay(player: SportingPlayer, slot: Slot): boolean {
  return positionPenalty(player, slot) !== null;
}

export function adjustedRating(player: SportingPlayer, slot: Slot): number {
  const penalty = positionPenalty(player, slot);
  if (penalty === null) return 0;
  return Math.max(40, player.rating + penalty);
}
