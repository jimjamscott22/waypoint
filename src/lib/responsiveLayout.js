export function layoutModeForWidth(width) {
  if (width < 768) return 'mobile';
  if (width < 1200) return 'compact';
  return 'wide';
}
