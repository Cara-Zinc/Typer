import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// One connected vault folder. Archiver picks it; Typer (and future modes)
// read it. Persisted to localStorage so it survives restarts. We keep the
// same storage key the old Archiver used so existing installs aren't
// forced to re-pick their folder.
const VAULT_PREF_KEY = "triptych.archiver.vaultPath";

type VaultContextValue = {
  vaultPath: string | null;
  loaded: boolean;
  setVaultPath: (path: string) => void;
  clearVaultPath: () => void;
};

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultPath, setVaultPathState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VAULT_PREF_KEY);
      if (saved) setVaultPathState(saved);
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const setVaultPath = useCallback((path: string) => {
    setVaultPathState(path);
    try {
      localStorage.setItem(VAULT_PREF_KEY, path);
    } catch {
      /* ignore */
    }
  }, []);

  const clearVaultPath = useCallback(() => {
    setVaultPathState(null);
    try {
      localStorage.removeItem(VAULT_PREF_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ vaultPath, loaded, setVaultPath, clearVaultPath }),
    [vaultPath, loaded, setVaultPath, clearVaultPath],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside <VaultProvider>");
  return ctx;
}
