import { useCallback, useEffect, useState } from "react";
import { Download, FolderOpen, Upload, X } from "lucide-react";
import { RewardIcon } from "../../components/RewardIcon";
import {
  exportBackup,
  importBackup,
  revealDataFolder,
  type ImportResult,
} from "../../state/habitsBackup";
import {
  cellStyle,
  COLOR_MONTH,
  COLOR_STREAK,
  COLOR_WEEK,
} from "./StatsStrip";

type Props = {
  onClose: () => void;
};

const SAMPLE_CELL = 36;

function SampleCell({ tokens, color }: { tokens: number; color: string }) {
  return <div style={cellStyle(tokens, color, SAMPLE_CELL)} />;
}

function PatternRow({
  tokens,
  color,
  label,
  rangeLabel,
}: {
  tokens: number;
  color: string;
  label: string;
  rangeLabel: string;
}) {
  return (
    <div className="flex items-center gap-4 py-2 border-b border-black/15 dark:border-white/15 last:border-b-0">
      <SampleCell tokens={tokens} color={color} />
      <div className="flex-1">
        <div className="font-serif font-bold text-sm">{label}</div>
        <div className="font-mono text-[0.65rem] opacity-60 tracking-wide">
          {rangeLabel}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-mono uppercase text-xs tracking-widest font-bold pb-1 border-b border-black dark:border-white">
        {title}
      </h3>
      <div className="font-serif text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export function HabitsHelp({ onClose }: Props) {
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  // Esc closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleExport = useCallback(async () => {
    setBackupStatus(null);
    setBackupBusy(true);
    try {
      const path = await exportBackup();
      if (path) setBackupStatus(`Saved → ${path}`);
    } catch (e) {
      setBackupStatus(
        `Export failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBackupBusy(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    setBackupStatus(null);
    if (
      !window.confirm(
        "Restoring will replace your current tokens, task log, and inventory. Continue?",
      )
    ) {
      return;
    }
    setBackupBusy(true);
    try {
      const result: ImportResult | null = await importBackup();
      if (!result) {
        setBackupBusy(false);
        return;
      }
      setBackupStatus(
        `Restored ${result.taskCount} tasks · ${result.inventoryCount} reward kinds · ${result.tokens} tokens. Reloading…`,
      );
      // Reload so every context (tokens, inventory, task log) re-reads
      // from disk. Simpler than threading refresh callbacks through every
      // sub-tab, and import is rare.
      window.setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      setBackupStatus(
        `Import failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      setBackupBusy(false);
    }
  }, []);

  const handleReveal = useCallback(async () => {
    setBackupStatus(null);
    setBackupBusy(true);
    try {
      const dir = await revealDataFolder();
      setBackupStatus(`Opened ${dir}`);
    } catch (e) {
      setBackupStatus(
        `Could not open folder: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBackupBusy(false);
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 dark:bg-white/30 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-black text-black dark:text-white border-2 border-black dark:border-white w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-black dark:border-white shrink-0">
          <div className="font-mono uppercase text-sm tracking-widest font-bold">
            Habit Tracker · How it Works
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="border border-black dark:border-white p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-6 space-y-8">
          {/* The big idea */}
          <Section title="The Big Idea">
            <p>
              You earn <strong>tokens</strong> by doing the things you said
              you'd do — exercise, reading, work sessions, anything. Tokens
              are the only currency in this app.
            </p>
            <p>
              You spend tokens on <strong>rewards</strong> — things you
              actually want — by buying them directly in the{" "}
              <span className="font-mono uppercase">Shop</span> or gambling
              for them in the <span className="font-mono uppercase">Slot</span>.
              Rewards you've earned live in{" "}
              <span className="font-mono uppercase">Owned</span> until you
              use them.
            </p>
            <p className="italic opacity-80">
              Everything in this app is black and white except the rewards
              you've already earned. Color is the prize.
            </p>
          </Section>

          {/* Exchange */}
          <Section title="Exchange — Earn Tokens">
            <p>
              Pick a task type, write a short description of what you did,
              choose how many tokens it's worth, and hit{" "}
              <span className="font-mono uppercase">Record</span>. Each task
              type has a default and a range so you can't accidentally
              over-reward yourself for small wins.
            </p>
            <p>
              Above the form, the <strong>stats strip</strong> tracks how
              hard you're working over time.
            </p>
          </Section>

          {/* Cell patterns */}
          <Section title="The Cell Grid — Your Daily Effort">
            <p>
              Each square in the stats strip represents one day. The
              texture inside the square shows how much you earned that day.
              The harder you worked, the denser the pattern. When a day
              clears <strong>150 tokens</strong>, the cell bursts into
              color.
            </p>
            <div className="border border-black dark:border-white p-4 my-2">
              <PatternRow
                tokens={0}
                color={COLOR_WEEK}
                label="Quiet day"
                rangeLabel="0 tokens — empty"
              />
              <PatternRow
                tokens={20}
                color={COLOR_WEEK}
                label="Small effort"
                rangeLabel="1 – 49 tokens — sparse dots"
              />
              <PatternRow
                tokens={75}
                color={COLOR_WEEK}
                label="Solid day"
                rangeLabel="50 – 99 tokens — diagonal stripes"
              />
              <PatternRow
                tokens={120}
                color={COLOR_WEEK}
                label="Strong day"
                rangeLabel="100 – 149 tokens — dense crosshatch"
              />
              <PatternRow
                tokens={200}
                color={COLOR_WEEK}
                label="Target hit"
                rangeLabel="150+ tokens — solid color"
              />
            </div>
            <p>
              Each stat window has its own colour for hitting the per-day
              target:
            </p>
            <div className="flex items-center gap-8 pl-2">
              <div className="flex items-center gap-3">
                <SampleCell tokens={200} color={COLOR_WEEK} />
                <span className="font-mono text-xs uppercase tracking-wide">
                  Week
                </span>
              </div>
              <div className="flex items-center gap-3">
                <SampleCell tokens={200} color={COLOR_MONTH} />
                <span className="font-mono text-xs uppercase tracking-wide">
                  Month
                </span>
              </div>
              <div className="flex items-center gap-3">
                <SampleCell tokens={200} color={COLOR_STREAK} />
                <span className="font-mono text-xs uppercase tracking-wide">
                  Streak
                </span>
              </div>
            </div>
            <p>
              When your <strong>average</strong> across the whole window
              crosses 150 tokens/day (or your streak reaches 7 consecutive
              days), the big number above the grid also colorizes — that's
              the secondary signal for sustained consistency.
            </p>
          </Section>

          {/* Shop */}
          <Section title="Shop — Buy Rewards Directly">
            <p>
              Every reward has a <strong>rarity</strong> from 1 to 9. Price
              is simply <span className="font-mono">30 × rarity</span> — so
              rare rewards cost more.
            </p>
            <p>
              In the shop, all reward icons are dim and grayscale. They
              don't belong to you yet. Buying one moves it into your{" "}
              <span className="font-mono uppercase">Owned</span> case in
              its full original color.
            </p>
            <div className="flex items-center gap-6 mt-2 pl-2">
              <div className="flex flex-col items-center gap-2">
                <div className="border border-black dark:border-white p-3">
                  <RewardIcon iconKey="tv" variant="shop" size={48} />
                </div>
                <span className="font-mono text-[0.6rem] uppercase tracking-wide opacity-60">
                  In the shop
                </span>
              </div>
              <div className="font-mono text-lg">→</div>
              <div className="flex flex-col items-center gap-2">
                <div className="border border-black dark:border-white p-3">
                  <RewardIcon
                    iconKey="tv"
                    variant="owned"
                    color="#E54B4B"
                    size={48}
                  />
                </div>
                <span className="font-mono text-[0.6rem] uppercase tracking-wide opacity-60">
                  Once owned
                </span>
              </div>
            </div>
          </Section>

          {/* Slot */}
          <Section title="Slot Machine — Risk for Reward">
            <p>
              Each spin costs <strong>10 tokens</strong>. Three reels cycle
              silhouettes; rare rewards almost never land on a reel because
              the weighting is inverse to rarity.
            </p>
            <ul className="list-square pl-5 space-y-1">
              <li>
                <strong>Two reels match</strong> → you win 1 of that
                reward.
              </li>
              <li>
                <strong>All three match</strong> → JACKPOT — you win 3 of
                that reward.
              </li>
              <li>
                <strong>No match</strong> → 10 tokens gone. Try again.
              </li>
            </ul>
            <p>
              When you win, the matching reels reveal in color — that's
              the only time during a spin color appears.
            </p>
          </Section>

          {/* Owned */}
          <Section title="Owned — Your Trophy Case">
            <p>
              The only screen in the entire app where color lives. Each
              reward you own appears as a tile in its assigned brand
              color, with a{" "}
              <span className="font-mono">×N</span> badge if you have more
              than one stacked.
            </p>
            <p>
              When you actually take the reward (watch the movie, take the
              day off, eat the meal), hit <strong>Redeem</strong>. You'll
              be asked to confirm — redeeming is permanent.
            </p>
          </Section>

          {/* Redeemed */}
          <Section title="Redeemed — Quiet Records">
            <p>
              Rewards you've already used. Their color drains back out and
              the name is struck through. They sit here as a permanent
              record of what you've claimed.
            </p>
            <p>
              You cannot un-redeem. Color is a finite resource — once
              you've spent it, it's gone.
            </p>
          </Section>

          {/* Color philosophy */}
          <Section title="Why So Black & White?">
            <p>
              Color releases more dopamine than monochrome. If color is
              everywhere, it's free — and if it's free, it's not a reward.
            </p>
            <p>
              In this app, color is rationed. The default state of
              everything is black and white. You earn color by doing the
              work — recording habits, hitting daily targets, sustaining
              streaks, redeeming what you've bought. The contrast itself
              becomes the prize.
            </p>
          </Section>

          {/* Backup & restore */}
          <Section title="Backup & Restore">
            <p>
              Your tokens, task log, and inventory live as three JSON
              files in a folder on this machine. Export them into a single
              bundle if you want a copy — for safekeeping or to move to
              another computer.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={handleExport}
                disabled={backupBusy}
                className="border border-black dark:border-white px-4 py-2 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={14} /> Export backup
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={backupBusy}
                className="border border-black dark:border-white px-4 py-2 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload size={14} /> Restore from backup
              </button>
              <button
                type="button"
                onClick={handleReveal}
                disabled={backupBusy}
                className="border border-black dark:border-white px-4 py-2 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Open the habits data folder in Finder"
              >
                <FolderOpen size={14} /> Open data folder
              </button>
            </div>
            {backupStatus && (
              <div className="mt-3 border border-black dark:border-white p-3 font-mono text-[0.7rem] leading-relaxed break-all">
                {backupStatus}
              </div>
            )}
            <p className="text-[0.8rem] italic opacity-70 mt-3">
              Restoring replaces your current data. Confirm twice — there
              is no undo.
            </p>
          </Section>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-black dark:border-white p-3 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="border border-black dark:border-white px-4 py-1.5 font-mono uppercase tracking-widest text-xs hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
