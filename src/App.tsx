import { useCallback, useEffect, useState } from "react";
import { BookOpen, Type, ZoomIn, Archive, Award, Upload, Moon, Sun } from "lucide-react";
import { NavButton } from "./components/NavButton";
import { ReadingTable } from "./modes/ReadingTable";
import { Typer } from "./modes/Typer";
import { Magnifier } from "./modes/Magnifier";
import { Archiver } from "./modes/Archiver";
import { Habits } from "./modes/Habits";
import { HabitsProvider } from "./state/HabitsContext";
import { InventoryProvider } from "./state/InventoryContext";

type Tab = "read" | "write" | "edit" | "archive" | "habits";
type AppTheme = "light" | "dark";

const THEME_PREF_KEY = "triptych.app.theme";

function loadAppTheme(): AppTheme {
  if (typeof localStorage === "undefined") return "light";
  return localStorage.getItem(THEME_PREF_KEY) === "dark" ? "dark" : "light";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("read");
  // Files dispatched here from another mode (e.g. the Archiver) end up
  // in pendingPath; the Reading Table picks it up and clears it.
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  // Global app theme — affects every tab's chrome. The Reader keeps its
  // own per-document paper theme on top of this.
  const [theme, setTheme] = useState<AppTheme>(loadAppTheme);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_PREF_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const requestOpenInReader = useCallback((path: string) => {
    setPendingPath(path);
    setActiveTab("read");
  }, []);

  const consumePendingPath = useCallback(() => {
    setPendingPath(null);
  }, []);

  return (
    <div
      className={`${theme === "dark" ? "dark" : ""} min-h-screen h-screen bg-white text-black dark:bg-black dark:text-white font-sans flex flex-col`}
    >
      <header className="flex justify-between items-center p-4 border-b border-black dark:border-white shrink-0">
        <div className="font-serif text-2xl font-bold tracking-tighter uppercase">Triptych</div>
        <nav className="flex border border-black dark:border-white overflow-hidden">
          <NavButton
            icon={<BookOpen size={18} />}
            label="Reading Table"
            isActive={activeTab === "read"}
            onClick={() => setActiveTab("read")}
          />
          <div className="w-px bg-black dark:bg-white" />
          <NavButton
            icon={<Type size={18} />}
            label="Typer"
            isActive={activeTab === "write"}
            onClick={() => setActiveTab("write")}
          />
          <div className="w-px bg-black dark:bg-white" />
          <NavButton
            icon={<ZoomIn size={18} />}
            label="Magnifier"
            isActive={activeTab === "edit"}
            onClick={() => setActiveTab("edit")}
          />
          <div className="w-px bg-black dark:bg-white" />
          <NavButton
            icon={<Archive size={18} />}
            label="Archiver"
            isActive={activeTab === "archive"}
            onClick={() => setActiveTab("archive")}
          />
          <div className="w-px bg-black dark:bg-white" />
          <NavButton
            icon={<Award size={18} />}
            label="Habits"
            isActive={activeTab === "habits"}
            onClick={() => setActiveTab("habits")}
          />
        </nav>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="text-sm font-mono uppercase tracking-widest flex items-center gap-1 cursor-pointer hover:underline"
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="text-sm font-mono uppercase tracking-widest flex items-center gap-2 cursor-pointer hover:underline">
            <Upload size={16} /> Import
          </div>
        </div>
      </header>

      {/* All five tabs stay mounted so their in-memory state (open document,
          current draft, connected vault tree, etc.) survives tab switches.
          Inactive tabs are display:none — they keep their state and effects
          but don't take layout space. HabitsProvider wraps the whole main
          area so the token counter & state are alive even when the Habits
          tab isn't visible. */}
      <HabitsProvider>
        <InventoryProvider>
          <main className="grow flex flex-col relative overflow-hidden">
          <div className={`grow flex flex-col min-h-0 ${activeTab === "read" ? "" : "hidden"}`}>
            <ReadingTable pendingPath={pendingPath} onPendingConsumed={consumePendingPath} />
          </div>
          <div className={`grow flex flex-col min-h-0 ${activeTab === "write" ? "" : "hidden"}`}>
            <Typer />
          </div>
          <div className={`grow flex flex-col min-h-0 ${activeTab === "edit" ? "" : "hidden"}`}>
            <Magnifier />
          </div>
          <div className={`grow flex flex-col min-h-0 ${activeTab === "archive" ? "" : "hidden"}`}>
            <Archiver onOpenFile={requestOpenInReader} />
          </div>
          <div className={`grow flex flex-col min-h-0 ${activeTab === "habits" ? "" : "hidden"}`}>
            <Habits />
          </div>
        </main>
        </InventoryProvider>
      </HabitsProvider>
    </div>
  );
}
