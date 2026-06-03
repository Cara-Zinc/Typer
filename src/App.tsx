// App.tsx — Modified to add Home as the first (default) top-level tab.
//
// Diff vs upstream:
//   - 'home' added to the Tab union
//   - <Home /> mounted at the top of the main panel
//   - ThemeProvider replaces the inline theme state — exposes dark to SVG
//     renderers via useTheme() (Tailwind `dark:` variant can't reach SVG fills)
//   - PetProvider + RoomLayoutProvider wrap the main area so pet state
//     and room layout survive tab switches
//   - Reading, writing, magnifier, archive, and habits tabs stay mounted
//
// Side-effect import of "./modes/home/pets" and "./modes/home/furniture"
// populates the registries before first render.

import { useCallback, useState } from "react";
import { BookOpen, Type, ZoomIn, Archive, Award, Upload, Moon, Sun, Home as HomeIcon } from "lucide-react";
import { NavButton } from "./components/NavButton";
import { ReadingTable } from "./modes/ReadingTable";
import { Typer } from "./modes/Typer";
import { Magnifier } from "./modes/Magnifier";
import { Archiver } from "./modes/Archiver";
import { Habits } from "./modes/Habits";
import { Home } from "./modes/Home";
import { HabitsProvider } from "./state/HabitsContext";
import { InventoryProvider } from "./state/InventoryContext";
import { PetProvider } from "./state/PetContext";
import { RoomLayoutProvider } from "./state/RoomLayoutContext";
import { ThemeProvider, useTheme } from "./state/ThemeContext";
import { ReaderAnnotationsProvider } from "./state/ReaderAnnotationsContext";
import { makeStudyLayout } from "./modes/home/furniture/layouts";
import type { ReaderOpenRequest } from "./modes/readers/readerTypes";
// Side-effect imports — these MUST be present to populate the registries.
import "./modes/home/pets";
import "./modes/home/furniture";

type Tab = "home" | "read" | "write" | "edit" | "archive" | "habits";

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const { theme, toggle } = useTheme();
  // Home is the default landing tab — onboarding lives there for first-run.
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [pendingOpenRequest, setPendingOpenRequest] = useState<ReaderOpenRequest | null>(null);

  const requestOpenInReader = useCallback((request: ReaderOpenRequest) => {
    setPendingOpenRequest(request);
    setActiveTab("read");
  }, []);

  const consumePendingOpenRequest = useCallback(() => {
    setPendingOpenRequest(null);
  }, []);

  const navigate = useCallback((target: "read" | "write" | "edit" | "archive" | "habits") => {
    setActiveTab(target);
  }, []);

  return (
    <div
      className={`${theme === "dark" ? "dark" : ""} min-h-screen h-screen bg-white text-black dark:bg-black dark:text-white font-sans flex flex-col`}
    >
      <header className="flex justify-between items-center p-4 border-b border-black dark:border-white shrink-0">
        <div className="font-serif text-2xl font-bold tracking-tighter uppercase">Triptych</div>
        <nav className="flex border border-black dark:border-white overflow-hidden">
          <NavButton icon={<HomeIcon size={18} />}  label="Home"          isActive={activeTab === "home"}    onClick={() => setActiveTab("home")} />
          <div className="w-px bg-black dark:bg-white" />
          <NavButton icon={<BookOpen size={18} />}  label="Reading Table" isActive={activeTab === "read"}    onClick={() => setActiveTab("read")} />
          <div className="w-px bg-black dark:bg-white" />
          <NavButton icon={<Type size={18} />}      label="Typer"         isActive={activeTab === "write"}   onClick={() => setActiveTab("write")} />
          <div className="w-px bg-black dark:bg-white" />
          <NavButton icon={<ZoomIn size={18} />}    label="Magnifier"     isActive={activeTab === "edit"}    onClick={() => setActiveTab("edit")} />
          <div className="w-px bg-black dark:bg-white" />
          <NavButton icon={<Archive size={18} />}   label="Archiver"      isActive={activeTab === "archive"} onClick={() => setActiveTab("archive")} />
          <div className="w-px bg-black dark:bg-white" />
          <NavButton icon={<Award size={18} />}     label="Habits"        isActive={activeTab === "habits"}  onClick={() => setActiveTab("habits")} />
        </nav>
        <div className="flex items-center gap-4">
          <button
            onClick={toggle}
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

      {/* All tabs stay mounted (display:hidden when inactive) so their state
          survives tab switches — same pattern as upstream. PetProvider and
          RoomLayoutProvider wrap the whole area so Home, Habits, etc.
          share one source of truth. */}
      <HabitsProvider>
        <InventoryProvider>
          <PetProvider>
            <RoomLayoutProvider initialLayout={makeStudyLayout()}>
              <ReaderAnnotationsProvider>
                <main className="grow flex flex-col relative overflow-hidden">
                  <div className={`grow flex flex-col min-h-0 ${activeTab === "home"    ? "" : "hidden"}`}>
                    <Home onNavigate={navigate} />
                  </div>
                  <div className={`grow flex flex-col min-h-0 ${activeTab === "read"    ? "" : "hidden"}`}>
                    <ReadingTable pendingOpenRequest={pendingOpenRequest} onPendingConsumed={consumePendingOpenRequest} />
                  </div>
                  <div className={`grow flex flex-col min-h-0 ${activeTab === "write"   ? "" : "hidden"}`}>
                    <Typer />
                  </div>
                  <div className={`grow flex flex-col min-h-0 ${activeTab === "edit"    ? "" : "hidden"}`}>
                    <Magnifier />
                  </div>
                  <div className={`grow flex flex-col min-h-0 ${activeTab === "archive" ? "" : "hidden"}`}>
                    <Archiver onOpenFile={requestOpenInReader} />
                  </div>
                  <div className={`grow flex flex-col min-h-0 ${activeTab === "habits"  ? "" : "hidden"}`}>
                    <Habits />
                  </div>
                </main>
              </ReaderAnnotationsProvider>
            </RoomLayoutProvider>
          </PetProvider>
        </InventoryProvider>
      </HabitsProvider>
    </div>
  );
}
