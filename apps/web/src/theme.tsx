import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'promaly-theme';

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* private mode — fall through to default */
  }
  return 'system';
}

function apply(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = preference;
}

/**
 * Three-state theme model (interaction-spec §2): `system` leaves the document
 * unstamped so `prefers-color-scheme` decides; an explicit choice stamps
 * `data-theme` and wins in both directions.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStored);

  useEffect(() => {
    apply(preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode — preference is session-only */
    }
  }, []);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
