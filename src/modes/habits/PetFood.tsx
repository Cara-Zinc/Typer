// PetFood.tsx — Habits sub-tab. Feed your pet with tokens.
//
// Same 30 × rarity pricing as RewardShop. Token spend goes through
// useHabits().spend(); hunger update through usePet().feed(). Both writes
// are serialized inside their own contexts — race-safe across sub-tabs.

import { useCallback, useState } from "react";
import { Coins } from "lucide-react";
import { useHabits } from "../../state/HabitsContext";
import { usePet } from "../../state/PetContext";
import { PetSprite } from "../../components/PetSprite";

type FoodDef = {
  id: string;
  name: string;
  rarity: number;
  hunger: number;
  desc: string;
  glyph: string;
};

const PET_FOODS: FoodDef[] = [
  { id: "berry",      name: "Inkberry",         rarity: 1, hunger: 8,   desc: "A small purple fruit. Vague taste of paper.",      glyph: "❍" },
  { id: "biscuit",    name: "Reader's Biscuit", rarity: 2, hunger: 18,  desc: "Dry, crumbly. Pairs with a long sentence.",        glyph: "□" },
  { id: "tea",        name: "Cup of Tea",       rarity: 2, hunger: 14,  desc: "Steam fogs the page. Restorative.",                glyph: "◐" },
  { id: "broth",      name: "Quiet Broth",      rarity: 3, hunger: 28,  desc: "Made from old book reviews. Surprisingly hearty.", glyph: "◯" },
  { id: "manuscript", name: "Manuscript Pie",   rarity: 5, hunger: 60,  desc: "A rare treat. Smells of vellum.",                  glyph: "✦" },
  { id: "comet",      name: "Comet Tail",       rarity: 8, hunger: 100, desc: "Only after a 7-day streak.",                       glyph: "⌖" },
];

function priceOf(f: FoodDef): number {
  return 30 * f.rarity;
}

export function PetFood() {
  const { tokens, spend } = useHabits();
  const { pet, feed } = usePet();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFeed = useCallback(
    async (food: FoodDef) => {
      setError(null);
      if (!pet) {
        setError("No pet yet — complete onboarding on the Home tab.");
        return;
      }
      const price = priceOf(food);
      setBusyId(food.id);
      try {
        const spent = await spend(price);
        if (!spent) {
          setError(`Not enough tokens for ${food.name}.`);
          return;
        }
        await feed(food.hunger);
        setFlash(`${pet.name} ate the ${food.name}.`);
        window.setTimeout(() => setFlash(null), 1600);
      } finally {
        setBusyId(null);
      }
    },
    [feed, pet, spend],
  );

  return (
    <div className="grow flex flex-col overflow-hidden relative">
      {/* Pet status strip */}
      <div className="border-b border-black dark:border-white p-4 px-6 flex items-center gap-5 shrink-0">
        <div className="w-16 h-[72px]">
          {pet ? (
            <PetSprite
              kindId={pet.kindId}
              mood={pet.hunger > 60 ? "happy" : pet.hunger < 30 ? "hungry" : "neutral"}
              hunger={pet.hunger}
              size={64}
              follow={false}
            />
          ) : null}
        </div>
        <div className="grow flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="font-serif text-2xl font-bold">{pet?.name ?? "—"}</span>
            <span className="font-mono uppercase tracking-widest text-[10px] opacity-55">
              {pet ? `pet · ${pet.kindId}` : "no pet adopted"}
            </span>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="font-mono uppercase tracking-widest text-[10px] opacity-65">Hunger</span>
            <div className="grow border border-black dark:border-white h-2.5 relative">
              <div
                className="absolute inset-0 bg-black dark:bg-white transition-[width] duration-300"
                style={{ width: `${pet?.hunger ?? 0}%` }}
              />
            </div>
            <span className="font-mono font-bold text-[11px] w-9 text-right tabular-nums">
              {pet ? `${Math.round(pet.hunger)}%` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Food grid */}
      <div className="grow overflow-y-auto p-6">
        <div className="flex justify-between mb-3.5 font-mono uppercase tracking-widest text-[11px] opacity-70">
          <span>Pet Food</span>
          <span>Price = 30 × rarity</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {PET_FOODS.map((f) => {
            const price = priceOf(f);
            const canAfford = tokens >= price && !!pet;
            return (
              <div key={f.id} className="border border-black dark:border-white flex flex-col bg-white dark:bg-black">
                <div className="aspect-square border-b border-black dark:border-white flex items-center justify-center font-mono text-[60px] opacity-70">
                  {f.glyph}
                </div>
                <div className="px-3.5 pt-2.5 pb-2 flex flex-col gap-1 grow">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-serif text-base font-bold leading-tight">{f.name}</div>
                    <div className="font-mono text-[0.6rem] tracking-widest uppercase opacity-50 shrink-0">R{f.rarity}</div>
                  </div>
                  <div className="font-serif text-xs italic leading-snug opacity-70">{f.desc}</div>
                  <div className="font-mono uppercase tracking-widest text-[9px] opacity-60 mt-1">+{f.hunger} hunger</div>
                </div>
                <div className="border-t border-black dark:border-white px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <div className="font-mono text-sm flex items-center gap-1.5">
                    <Coins size={14} /> <span className="font-bold tabular-nums">{price}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleFeed(f)}
                    disabled={!canAfford || busyId === f.id}
                    title={!pet ? "Adopt a pet first" : !canAfford ? `Need ${price - tokens} more tokens` : undefined}
                    className="border border-black dark:border-white px-3.5 py-1.5 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current dark:disabled:hover:bg-transparent dark:disabled:hover:text-current"
                  >
                    {busyId === f.id ? "…" : "Feed"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="max-w-md mx-auto mt-6 border border-black dark:border-white p-3 font-mono text-xs leading-relaxed">
            <span className="font-bold block mb-1">Error</span>
            {error}
          </div>
        )}
      </div>

      {flash && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 border border-black dark:border-white bg-white dark:bg-black px-5 py-2 font-mono uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
          {flash}
        </div>
      )}
    </div>
  );
}
