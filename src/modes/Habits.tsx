import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useHabits } from "../state/HabitsContext";
import { TokenExchange } from "./habits/TokenExchange";
import { RewardShop } from "./habits/RewardShop";
import { Owned } from "./habits/Owned";
import { Redeemed } from "./habits/Redeemed";
import { SlotMachine } from "./habits/SlotMachine";
import { HabitsHelp } from "./habits/HabitsHelp";

type SubTab = "exchange" | "slot" | "shop" | "owned" | "redeemed";

const TRANSACTION_TABS: { id: SubTab; label: string }[] = [
  { id: "exchange", label: "Exchange" },
  { id: "slot", label: "Slot" },
  { id: "shop", label: "Shop" },
];

const COLLECTION_TABS: { id: SubTab; label: string }[] = [
  { id: "owned", label: "Owned" },
  { id: "redeemed", label: "Redeemed" },
];

function SubTabButton({
  id,
  label,
  active,
  onClick,
}: {
  id: SubTab;
  label: string;
  active: boolean;
  onClick: (id: SubTab) => void;
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-5 py-2 text-xs font-mono uppercase tracking-widest transition-colors duration-150 ${
        active
          ? "bg-black text-white dark:bg-white dark:text-black"
          : "bg-white text-black hover:bg-black hover:text-white dark:bg-black dark:text-white dark:hover:bg-white dark:hover:text-black"
      }`}
    >
      {label}
    </button>
  );
}

export function Habits() {
  const { tokens, loaded } = useHabits();
  const [sub, setSub] = useState<SubTab>("exchange");
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="grow flex flex-col bg-white dark:bg-black text-black dark:text-white overflow-hidden">
      {/* Sub-tab strip: transactions | collection ........ token counter */}
      <div className="flex items-stretch border-b border-black dark:border-white shrink-0">
        <div className="flex">
          {TRANSACTION_TABS.map((t) => (
            <SubTabButton
              key={t.id}
              id={t.id}
              label={t.label}
              active={sub === t.id}
              onClick={setSub}
            />
          ))}
        </div>
        <div className="w-px bg-black dark:bg-white my-2 mx-3" />
        <div className="flex">
          {COLLECTION_TABS.map((t) => (
            <SubTabButton
              key={t.id}
              id={t.id}
              label={t.label}
              active={sub === t.id}
              onClick={setSub}
            />
          ))}
        </div>
        <div className="grow" />
        <div className="flex items-center px-5 font-mono text-sm tracking-widest border-l border-black dark:border-white">
          <span className="opacity-50 mr-3 text-xs uppercase">Tokens</span>
          <span className="font-bold tabular-nums">
            {loaded ? tokens : "—"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="How it works"
          title="How it works"
          className="flex items-center justify-center px-4 border-l border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {/* Sub-tab content area. Panels stay mounted via display:none so their
          per-tab state (form drafts, scroll position, in-flight slot spin,
          etc.) survives switching. */}
      <div className="grow flex flex-col min-h-0 overflow-hidden relative">
        <div className={`grow flex flex-col min-h-0 ${sub === "exchange" ? "" : "hidden"}`}>
          <TokenExchange />
        </div>
        <div className={`grow flex flex-col min-h-0 ${sub === "shop" ? "" : "hidden"}`}>
          <RewardShop />
        </div>
        <div className={`grow flex flex-col min-h-0 ${sub === "owned" ? "" : "hidden"}`}>
          <Owned />
        </div>
        <div className={`grow flex flex-col min-h-0 ${sub === "redeemed" ? "" : "hidden"}`}>
          <Redeemed />
        </div>
        <div className={`grow flex flex-col min-h-0 ${sub === "slot" ? "" : "hidden"}`}>
          <SlotMachine />
        </div>
      </div>

      {helpOpen && <HabitsHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
