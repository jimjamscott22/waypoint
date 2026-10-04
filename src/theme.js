const lightColor = {
  pageBg: '#f4f7f8',
  cardBg: '#ffffff',
  cardBorder: '#d5dfe0',
  rowDivider: '#e1e8e9',
  inputBg: '#f8fafa',
  inputBorder: '#cbd7d8',
  dashedBorder: '#a9bbbd',
  ink: '#183843',
  textSecondary: '#53666b',
  textMuted: '#76898d',
  textBodyMid: '#334c53',
  accent: '#a9553e',
  accentHover: '#8f4534',
  accentSoft: '#f4e2dd',
  accentLight: '#e7a998',
  urgent: '#9e3f36',
  sidebarBg: '#183843',
  sidebarText: '#d7e4e4',
  sidebarMuted: '#9eb2b5',
  sidebarBulletOutline: '#6f8a8e',
  tideglass: '#d8ece8',
  reviewBg: '#edf3f2',
  focusRing: '#a9553e',
};

const lightChips = {
  Saved: { bg: '#d8ece8', fg: '#245d56' },
  Applied: { bg: '#e3eef5', fg: '#2d638b' },
  Interviewing: { bg: '#f6eacb', fg: '#7a5b12' },
  Offer: { bg: '#ddeee5', fg: '#2f6b4f' },
  Closed: { bg: '#e8ecec', fg: '#667275' },
};

export const font = {
  heading: "'Bricolage Grotesque', sans-serif",
  body: "'IBM Plex Sans', system-ui, sans-serif",
  utility: "'IBM Plex Mono', ui-monospace, monospace",
};

export const radius = {
  pill: 999,
  card: 14,
  statCard: 11,
  input: 9,
  smallButton: 8,
  badge: 6,
};

const lightShadow = {
  card: '0 10px 28px rgba(24,56,67,0.06)',
  raised: '0 18px 48px rgba(24,56,67,0.16)',
};

// Components keep inline styles; CSS variables update every surface together.
lightColor.onAccent = '#ffffff';
lightColor.onInk = '#ffffff';
lightColor.toastBg = '#183843';
lightColor.urgentSoft = '#fbefed';
lightColor.urgentBorder = '#e7bbb7';
lightColor.warningBg = '#fff8e8';
lightColor.warningBorder = '#efd9a5';
lightColor.navBg = 'rgba(255,255,255,0.96)';
lightColor.emptyBg = 'rgba(255,255,255,0.5)';

const darkColor = {
  ...lightColor,
  pageBg: '#101c22', cardBg: '#192a32', cardBorder: '#354a53',
  rowDivider: '#2b4049', inputBg: '#14242c', inputBorder: '#48616c',
  dashedBorder: '#59727c', ink: '#e2efef', textSecondary: '#b6c9cc',
  textMuted: '#95aeb5', textBodyMid: '#ccdcdf',
  accent: '#e7a18a', accentHover: '#f2b6a2', accentSoft: '#48312d',
  accentLight: '#edb29e', urgent: '#f3a49d',
  toastBg: '#183843', sidebarBg: '#0b171d', sidebarText: '#d7e4e4', sidebarMuted: '#9eb2b5',
  tideglass: '#24443f', reviewBg: '#14262d', focusRing: '#e7a18a',
  onAccent: '#291912', onInk: '#101c22', urgentSoft: '#442c2d',
  urgentBorder: '#79504e', warningBg: '#3b3423', warningBorder: '#78663b',
  navBg: 'rgba(25,42,50,0.96)', emptyBg: 'rgba(25,42,50,0.5)',
};
const darkChips = {
  Saved: { bg: '#24443f', fg: '#a5ddd2' },
  Applied: { bg: '#263f54', fg: '#b3d6f3' },
  Interviewing: { bg: '#493e24', fg: '#eed38e' },
  Offer: { bg: '#294536', fg: '#b3e0c4' },
  Closed: { bg: '#334149', fg: '#bfcccf' },
};
const variables = (tokens, prefix) => Object.fromEntries(
  Object.keys(tokens).map(key => [key, `var(--${prefix}-${key})`])
);
export const color = variables(lightColor, 'color');
export const chipColor = Object.fromEntries(Object.entries(lightChips).map(
  ([stage, tokens]) => [stage, variables(tokens, `chip-${stage}`)]
));
export const shadow = variables(lightShadow, 'shadow');
export const THEME_STORAGE_KEY = 'waypoint.theme.v1';

export function readThemePreference() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch { return null; }
}
export function getInitialTheme() {
  return readThemePreference() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
export function applyTheme(mode) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  const setTokens = (tokens, prefix) => Object.entries(tokens).forEach(
    ([key, value]) => root.style.setProperty(`--${prefix}-${key}`, value)
  );
  setTokens(mode === 'dark' ? darkColor : lightColor, 'color');
  Object.entries(mode === 'dark' ? darkChips : lightChips).forEach(
    ([stage, tokens]) => setTokens(tokens, `chip-${stage}`)
  );
  setTokens(mode === 'dark' ? {
    card: '0 10px 28px rgba(0,0,0,0.18)', raised: '0 18px 48px rgba(0,0,0,0.4)',
  } : lightShadow, 'shadow');
}
