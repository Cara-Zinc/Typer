// The reward catalog. The Shop reads from here and writes purchases into
// inventory.json. The Slot Machine will pull from a separate set later.
//
// `color` is the hue the icon takes on once the reward is OWNED. In the
// shop and during slot spin the icon renders in monochrome (grayscale +
// reduced opacity) — color is exclusively the visual reward for spending
// tokens. See [[feedback-color-as-reward]] in CLAUDE memory.

export type IconKey =
  | "tv"
  | "book"
  | "dessert"
  | "game"
  | "meal"
  | "movie"
  | "dayoff"
  | "shopping"
  | "sleep"
  | "bed";

export type RewardDef = {
  id: string;
  name: string;
  description: string;
  iconKey: IconKey;
  rarity: number; // 1-10, affects price (price = 30 * rarity)
  color: string; // CSS color applied when owned
};

export const SHOP_REWARDS: RewardDef[] = [
  {
    id: "tv-session",
    name: "TV Session",
    description: "Watch TV for 1 hour, guilt-free.",
    iconKey: "tv",
    rarity: 2,
    color: "#E54B4B",
  },
  {
    id: "gaming-break",
    name: "Gaming Break",
    description: "Play games for 1 hour.",
    iconKey: "game",
    rarity: 3,
    color: "#B14AED",
  },
  {
    id: "dessert-treat",
    name: "Dessert Treat",
    description: "Enjoy a dessert of your choice.",
    iconKey: "dessert",
    rarity: 1,
    color: "#E04A8F",
  },
  {
    id: "day-off",
    name: "Day Off",
    description: "Take a full day off from responsibilities.",
    iconKey: "dayoff",
    rarity: 9,
    color: "#1FB8B8",
  },
  {
    id: "shopping-spree",
    name: "Shopping Spree",
    description: "Treat yourself to something nice.",
    iconKey: "shopping",
    rarity: 4,
    color: "#3D9970",
  },
  {
    id: "late-sleep",
    name: "Late Sleep",
    description: "Sleep in an extra hour tomorrow.",
    iconKey: "sleep",
    rarity: 2,
    color: "#5A4FCF",
  },
  {
    id: "movie-night",
    name: "Movie Night",
    description: "Watch any movie of your choice.",
    iconKey: "movie",
    rarity: 2,
    color: "#D94A3F",
  },
  {
    id: "restaurant-meal",
    name: "Restaurant Meal",
    description: "Eat at your favorite restaurant.",
    iconKey: "meal",
    rarity: 3,
    color: "#E48B00",
  },
  {
    id: "reading-hour",
    name: "Reading Hour",
    description: "A full hour curled up with a book.",
    iconKey: "book",
    rarity: 1,
    color: "#3D7BD9",
  },
];

export function priceOf(reward: RewardDef): number {
  return 30 * reward.rarity;
}

export function findReward(id: string): RewardDef | undefined {
  return SHOP_REWARDS.find((r) => r.id === id);
}
