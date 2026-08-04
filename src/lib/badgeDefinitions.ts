export interface BadgeStats {
  totalBets: number;
  wins: number;
  losses: number;
  currentWinStreak: number;
  longestWinStreak: number;
  biggestUpsetOdds: number;
  seasonsPlayed: number;
  netUnitsAllTime: number;
}

export interface BadgeDefinition {
  id: string;
  label: string;
  description: string;
  target: number;
  progress: (stats: BadgeStats) => number;
  check: (stats: BadgeStats) => boolean;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-blood",
    label: "First Blood",
    description: "Place your first bet.",
    target: 1,
    progress: (stats) => Math.min(stats.totalBets, 1),
    check: (stats) => stats.totalBets >= 1,
  },
  {
    id: "on-fire",
    label: "On Fire",
    description: "Win 5 bets in a row.",
    target: 5,
    progress: (stats) => Math.min(stats.longestWinStreak, 5),
    check: (stats) => stats.longestWinStreak >= 5,
  },
  {
    id: "giant-killer",
    label: "Giant Killer",
    description: "Win a bet at 5x odds or longer.",
    target: 5,
    progress: (stats) => Math.min(stats.biggestUpsetOdds, 5),
    check: (stats) => stats.biggestUpsetOdds >= 5,
  },
  {
    id: "high-roller",
    label: "High Roller",
    description: "Finish a season with 100+ net units.",
    target: 100,
    progress: (stats) => Math.max(0, Math.min(stats.netUnitsAllTime, 100)),
    check: (stats) => stats.netUnitsAllTime >= 100,
  },
  {
    id: "iron-stomach",
    label: "Iron Stomach",
    description: "Place 25 bets — win or lose, you keep coming back.",
    target: 25,
    progress: (stats) => Math.min(stats.totalBets, 25),
    check: (stats) => stats.totalBets >= 25,
  },
  {
    id: "veteran",
    label: "Veteran",
    description: "Play 3 seasons.",
    target: 3,
    progress: (stats) => Math.min(stats.seasonsPlayed, 3),
    check: (stats) => stats.seasonsPlayed >= 3,
  },
];
