import { useMemo, useState, type ReactNode } from "react";
import {
  Armchair,
  Copy,
  Gift,
  LayoutGrid,
  Moon,
  Palette,
  PawPrint,
  Search,
  Sun,
} from "lucide-react";
import { RewardIcon } from "../components/RewardIcon";
import { PetSprite } from "../components/PetSprite";
import {
  SHOP_REWARDS,
  priceOf,
  type IconKey,
  type RewardDef,
} from "./habits/rewards";
import { allFurniture } from "./home/furniture";
import type { FurnitureKind, FurnitureState } from "./home/furniture/types";
import { allPetKinds, type PetKind, type PetMood } from "./home/pets";
import type { IllustrationTone } from "./home/illustration";

type AtlasKind = "pets" | "furniture" | "rewards";
type PreviewTheme = "light" | "dark";

type MetadataRow = {
  label: string;
  value: string | number;
  copyable?: boolean;
};

type PreviewOptions = {
  tone: IllustrationTone;
  dark: boolean;
  size: number;
};

type AtlasItem = {
  key: string;
  kind: AtlasKind;
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  searchText: string;
  metadata: MetadataRow[];
  swatch?: string;
  renderPreview: (options: PreviewOptions) => ReactNode;
};

type RewardAtlasAsset = {
  id: string;
  name: string;
  description: string;
  iconKey: IconKey;
  color: string | null;
  rarity: number | null;
  price: number | null;
  source: string;
};

const ASSET_TABS: Array<{ id: AtlasKind; label: string; icon: ReactNode }> = [
  { id: "pets", label: "Pets", icon: <PawPrint size={14} /> },
  { id: "furniture", label: "Furniture", icon: <Armchair size={14} /> },
  { id: "rewards", label: "Rewards", icon: <Gift size={14} /> },
];

const PET_MOODS: PetMood[] = ["neutral", "happy", "hungry", "sleep", "curious"];

const REWARD_ICON_KEYS: IconKey[] = [
  "tv",
  "book",
  "dessert",
  "game",
  "meal",
  "movie",
  "dayoff",
  "shopping",
  "sleep",
  "bed",
];

const MOCK_FURNITURE_STATE: FurnitureState = {
  time: new Date("2026-06-04T20:15:00"),
  dayPhase: "dusk",
  streak: 9,
  pagesRead: 88,
  words: 1750,
  tokensToday: 120,
  quote: { author: "Kafka" },
};

function buildPetItem(pet: PetKind): AtlasItem {
  return {
    key: `pets:${pet.id}`,
    kind: "pets",
    id: pet.id,
    name: pet.name,
    eyebrow: `${pet.species} / ${pet.mbtiTypes.join(", ")}`,
    description: pet.credo,
    searchText: [
      pet.id,
      pet.name,
      pet.species,
      pet.credo,
      ...pet.mbtiTypes,
    ].join(" ").toLowerCase(),
    metadata: [
      { label: "id", value: pet.id, copyable: true },
      { label: "name", value: pet.name },
      { label: "species", value: pet.species },
      { label: "mbti", value: pet.mbtiTypes.join(", ") },
      { label: "aspect", value: pet.aspect.toFixed(2) },
      { label: "source", value: "src/modes/home/pets", copyable: true },
    ],
    renderPreview: ({ tone, dark, size }) => (
      <div className="grid grid-cols-5 gap-2 w-full">
        {PET_MOODS.map((mood) => (
          <div key={mood} className="flex flex-col items-center gap-2 min-w-0">
            <div className="h-24 flex items-end justify-center">
              <PetSprite
                kindId={pet.id}
                mood={mood}
                hunger={mood === "hungry" ? 18 : 80}
                size={Math.max(52, Math.min(88, size * 0.48))}
                color="#8c6a35"
                tone={tone}
                dark={dark}
                follow={false}
              />
            </div>
            <div className="font-mono uppercase tracking-widest text-[8px] opacity-55 truncate max-w-full">
              {mood}
            </div>
          </div>
        ))}
      </div>
    ),
  };
}

function buildFurnitureItem(kind: FurnitureKind): AtlasItem {
  return {
    key: `furniture:${kind.id}`,
    kind: "furniture",
    id: kind.id,
    name: kind.name,
    eyebrow: `${kind.category} / ${kind.anchor}`,
    description: kind.description,
    searchText: [
      kind.id,
      kind.name,
      kind.category,
      kind.anchor,
      kind.description,
      String(kind.price),
    ].join(" ").toLowerCase(),
    metadata: [
      { label: "id", value: kind.id, copyable: true },
      { label: "category", value: kind.category },
      { label: "anchor", value: kind.anchor },
      { label: "size", value: `${kind.size.w} x ${kind.size.h}` },
      { label: "price", value: kind.price ? kind.price : "free" },
      { label: "source", value: "src/modes/home/furniture/items.tsx", copyable: true },
    ],
    renderPreview: ({ tone, dark, size }) => {
      const longestSide = Math.max(kind.size.w, kind.size.h);
      const scale = Math.min(1, size / longestSide);
      return (
        <div className="w-full h-full min-h-36 flex items-center justify-center">
          <div
            style={{
              width: kind.size.w * scale,
              height: kind.size.h * scale,
            }}
          >
            {kind.render({
              dark,
              tone,
              accent: "#8c6a35",
              state: MOCK_FURNITURE_STATE,
            })}
          </div>
        </div>
      );
    },
  };
}

function rewardAssets(): RewardAtlasAsset[] {
  const catalogAssets = SHOP_REWARDS.map((reward: RewardDef) => ({
    id: reward.id,
    name: reward.name,
    description: reward.description,
    iconKey: reward.iconKey,
    color: reward.color,
    rarity: reward.rarity,
    price: priceOf(reward),
    source: "src/modes/habits/rewards.ts",
  }));
  const catalogIconKeys = new Set(catalogAssets.map((asset) => asset.iconKey));
  const iconOnlyAssets = REWARD_ICON_KEYS
    .filter((iconKey) => !catalogIconKeys.has(iconKey))
    .map((iconKey) => ({
      id: `icon:${iconKey}`,
      name: `${iconKey}.svg`,
      description: "Raw Habits reward SVG asset; not currently exposed by the shop catalog.",
      iconKey,
      color: null,
      rarity: null,
      price: null,
      source: `src/assets/habits/${iconKey}.svg`,
    }));
  return [...catalogAssets, ...iconOnlyAssets];
}

function buildRewardItem(asset: RewardAtlasAsset): AtlasItem {
  const color = asset.color ?? "#8c6a35";
  return {
    key: `rewards:${asset.id}`,
    kind: "rewards",
    id: asset.id,
    name: asset.name,
    eyebrow: `${asset.iconKey}${asset.rarity ? ` / rarity ${asset.rarity}` : " / raw icon"}`,
    description: asset.description,
    searchText: [
      asset.id,
      asset.name,
      asset.description,
      asset.iconKey,
      asset.source,
      asset.rarity ?? "",
      asset.price ?? "",
    ].join(" ").toLowerCase(),
    swatch: asset.color ?? undefined,
    metadata: [
      { label: "id", value: asset.id, copyable: true },
      { label: "iconKey", value: asset.iconKey, copyable: true },
      { label: "rarity", value: asset.rarity ?? "n/a" },
      { label: "price", value: asset.price ?? "n/a" },
      { label: "color", value: asset.color ?? "n/a", copyable: Boolean(asset.color) },
      { label: "source", value: asset.source, copyable: true },
    ],
    renderPreview: ({ size }) => (
      <div className="grid grid-cols-3 gap-4 w-full place-items-center">
        {(["shop", "owned", "spent"] as const).map((variant) => (
          <div key={variant} className="flex flex-col items-center gap-2 min-w-0">
            <RewardIcon
              iconKey={asset.iconKey}
              variant={variant}
              color={color}
              size={Math.max(48, Math.min(92, size * 0.5))}
            />
            <div className="font-mono uppercase tracking-widest text-[8px] opacity-55">
              {variant}
            </div>
          </div>
        ))}
      </div>
    ),
  };
}

function buildDeveloperAtlasItems(): AtlasItem[] {
  return [
    ...allPetKinds().map(buildPetItem),
    ...allFurniture().map(buildFurnitureItem),
    ...rewardAssets().map(buildRewardItem),
  ];
}

export function DeveloperAtlas() {
  const [activeKind, setActiveKind] = useState<AtlasKind>("pets");
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState<IllustrationTone>("mono");
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>("light");
  const [previewSize, setPreviewSize] = useState(180);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const allItems = useMemo(() => buildDeveloperAtlasItems(), []);
  const counts = useMemo(
    () => ({
      pets: allItems.filter((item) => item.kind === "pets").length,
      furniture: allItems.filter((item) => item.kind === "furniture").length,
      rewards: allItems.filter((item) => item.kind === "rewards").length,
    }),
    [allItems],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = useMemo(
    () =>
      allItems.filter(
        (item) =>
          item.kind === activeKind &&
          (!normalizedQuery || item.searchText.includes(normalizedQuery)),
      ),
    [activeKind, allItems, normalizedQuery],
  );
  const selectedItem =
    allItems.find((item) => item.key === selectedKey) ??
    visibleItems[0] ??
    null;
  const dark = previewTheme === "dark";

  async function copyValue(label: string, value: string | number) {
    const text = String(value);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLabel(label);
    } catch {
      setCopiedLabel("copy failed");
    }
  }

  return (
    <div className="grow min-h-0 flex flex-col bg-white text-black dark:bg-black dark:text-white overflow-hidden">
      <header className="border-b border-black dark:border-white">
        <div className="px-6 py-4 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="font-mono uppercase tracking-widest text-[10px] opacity-60">
              internal / designers / developers
            </div>
            <h1 className="font-serif text-3xl leading-tight font-bold tracking-normal">
              Developer SVG Atlas
            </h1>
          </div>
          <div className="grid grid-cols-3 border border-black dark:border-white shrink-0">
            {ASSET_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveKind(tab.id);
                  setSelectedKey(null);
                }}
                className={[
                  "px-4 py-2.5 flex items-center gap-2 font-mono uppercase tracking-widest text-[10px] transition-colors",
                  activeKind === tab.id
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black",
                ].join(" ")}
                title={`Show ${tab.label.toLowerCase()}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className="opacity-55">{counts[tab.id]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-black dark:border-white grid grid-cols-[minmax(260px,1fr)_auto_auto_auto]">
          <label className="px-5 py-3 flex items-center gap-3 border-r border-black dark:border-white min-w-0">
            <Search size={15} className="shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search id, name, source, category..."
              className="w-full bg-transparent outline-none font-mono text-[12px] placeholder:text-current placeholder:opacity-35"
            />
          </label>
          <SegmentedTone tone={tone} setTone={setTone} />
          <ThemeToggle previewTheme={previewTheme} setPreviewTheme={setPreviewTheme} />
          <label className="px-5 py-3 flex items-center gap-3 font-mono uppercase tracking-widest text-[10px]">
            <LayoutGrid size={14} />
            <span>Size</span>
            <input
              type="range"
              min={120}
              max={240}
              step={10}
              value={previewSize}
              onChange={(event) => setPreviewSize(Number(event.target.value))}
              className="w-28 accent-current"
            />
            <span className="opacity-55 w-8 text-right">{previewSize}</span>
          </label>
        </div>
      </header>

      <div className="grow min-h-0 grid grid-cols-[minmax(0,1fr)_340px]">
        <main className="overflow-auto">
          <div className="p-5 grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {visibleItems.map((item) => (
              <AtlasCard
                key={item.key}
                item={item}
                selected={item.key === selectedItem?.key}
                options={{ tone, dark, size: previewSize }}
                onSelect={() => setSelectedKey(item.key)}
              />
            ))}
            {!visibleItems.length && (
              <div className="border border-dashed border-black dark:border-white p-8 font-serif italic opacity-60">
                No atlas entries match this search.
              </div>
            )}
          </div>
        </main>
        <DetailsPanel
          item={selectedItem}
          copiedLabel={copiedLabel}
          onCopy={copyValue}
        />
      </div>
    </div>
  );
}

function SegmentedTone({
  tone,
  setTone,
}: {
  tone: IllustrationTone;
  setTone: (tone: IllustrationTone) => void;
}) {
  return (
    <div className="flex border-r border-black dark:border-white">
      {(["mono", "color"] as const).map((nextTone) => (
        <button
          key={nextTone}
          type="button"
          onClick={() => setTone(nextTone)}
          className={[
            "px-4 py-3 flex items-center gap-2 font-mono uppercase tracking-widest text-[10px] transition-colors",
            tone === nextTone
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black",
          ].join(" ")}
          title={`Preview ${nextTone} illustrations`}
        >
          <Palette size={14} />
          <span>{nextTone}</span>
        </button>
      ))}
    </div>
  );
}

function ThemeToggle({
  previewTheme,
  setPreviewTheme,
}: {
  previewTheme: PreviewTheme;
  setPreviewTheme: (theme: PreviewTheme) => void;
}) {
  return (
    <div className="flex border-r border-black dark:border-white">
      {(["light", "dark"] as const).map((theme) => (
        <button
          key={theme}
          type="button"
          onClick={() => setPreviewTheme(theme)}
          className={[
            "px-4 py-3 flex items-center gap-2 font-mono uppercase tracking-widest text-[10px] transition-colors",
            previewTheme === theme
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black",
          ].join(" ")}
          title={`Preview ${theme} mode`}
        >
          {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
          <span>{theme}</span>
        </button>
      ))}
    </div>
  );
}

function AtlasCard({
  item,
  selected,
  options,
  onSelect,
}: {
  item: AtlasItem;
  selected: boolean;
  options: PreviewOptions;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "text-left border border-black dark:border-white bg-white dark:bg-black transition-colors",
        "hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black",
        selected ? "outline outline-2 outline-offset-2 outline-black dark:outline-white" : "",
      ].join(" ")}
    >
      <div
        className={[
          "h-52 border-b border-black dark:border-white flex items-center justify-center p-4",
          options.dark ? "bg-black text-white" : "bg-white text-black",
        ].join(" ")}
      >
        {item.renderPreview(options)}
      </div>
      <div className="p-4 flex flex-col gap-2 min-h-32">
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono uppercase tracking-widest text-[9px] opacity-55 truncate">
            {item.eyebrow}
          </div>
          {item.swatch && (
            <span
              className="w-4 h-4 border border-current shrink-0"
              style={{ backgroundColor: item.swatch }}
              title={item.swatch}
            />
          )}
        </div>
        <div className="font-serif font-bold text-xl leading-tight">{item.name}</div>
        <div className="font-mono text-[10px] leading-relaxed opacity-65 break-all">
          {item.id}
        </div>
        <div className="font-serif italic text-sm leading-snug opacity-75 line-clamp-2">
          {item.description}
        </div>
      </div>
    </button>
  );
}

function DetailsPanel({
  item,
  copiedLabel,
  onCopy,
}: {
  item: AtlasItem | null;
  copiedLabel: string | null;
  onCopy: (label: string, value: string | number) => void;
}) {
  return (
    <aside className="border-l border-black dark:border-white overflow-auto">
      <div className="sticky top-0 bg-white dark:bg-black border-b border-black dark:border-white p-4 z-10">
        <div className="font-mono uppercase tracking-widest text-[10px] opacity-55">
          Selected metadata
        </div>
        <div className="font-serif font-bold text-2xl leading-tight mt-1">
          {item?.name ?? "No selection"}
        </div>
      </div>
      {item ? (
        <div className="p-4 flex flex-col gap-4">
          <div className="border border-black dark:border-white p-4">
            <div className="font-mono uppercase tracking-widest text-[9px] opacity-55 mb-2">
              Description
            </div>
            <p className="font-serif italic leading-relaxed m-0">{item.description}</p>
          </div>
          <div className="border border-black dark:border-white">
            {item.metadata.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[88px_minmax(0,1fr)_36px] border-b last:border-b-0 border-black dark:border-white min-h-11"
              >
                <div className="px-3 py-2 border-r border-black dark:border-white font-mono uppercase tracking-widest text-[9px] opacity-55">
                  {row.label}
                </div>
                <div className="px-3 py-2 font-mono text-[11px] break-all flex items-center">
                  {String(row.value)}
                </div>
                <div className="border-l border-black dark:border-white flex items-stretch">
                  {row.copyable ? (
                    <button
                      type="button"
                      onClick={() => onCopy(row.label, row.value)}
                      className="w-full flex items-center justify-center hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                      title={`Copy ${row.label}`}
                    >
                      <Copy size={13} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="font-mono uppercase tracking-widest text-[10px] opacity-60">
            {copiedLabel ? `Clipboard: ${copiedLabel}` : "Copy buttons write raw metadata values"}
          </div>
        </div>
      ) : (
        <div className="p-4 font-serif italic opacity-60">
          Select an atlas entry to inspect its source metadata.
        </div>
      )}
    </aside>
  );
}
