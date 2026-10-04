import { useEffect, useState } from 'react';
import { applyTheme, getInitialTheme, readThemePreference, THEME_STORAGE_KEY } from '../theme';

export default function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [explicitChoice, setExplicitChoice] = useState(() => readThemePreference() !== null);

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    if (explicitChoice) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setTheme(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [explicitChoice]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setExplicitChoice(true);
    setTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Still works when storage is unavailable. */ }
  }
  return { theme, toggleTheme };
}
