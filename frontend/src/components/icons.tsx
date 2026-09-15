/** Small, single-tone line icons shared across the admin dashboard and the sidebar nav —
 * kept in-house rather than pulling in an icon library for a couple dozen glyphs. All 24x24,
 * stroke-based, and deliberately monochrome so they read as one family wherever they're used. */

export function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.4" />
      <rect x="13" y="3" width="8" height="5" rx="1.4" />
      <rect x="13" y="10" width="8" height="11" rx="1.4" />
      <rect x="3" y="13" width="8" height="8" rx="1.4" />
    </svg>
  );
}

export function IconGraduationCap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
    </svg>
  );
}

export function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="11" height="18" rx="1.2" />
      <path d="M15 8h5v13h-5M7.5 7h1M10.5 7h1M7.5 10.5h1M10.5 10.5h1M7.5 14h1M10.5 14h1M7.5 17.5h1M10.5 17.5h1" />
    </svg>
  );
}

export function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" />
      <circle cx="17.5" cy="9.5" r="2.3" />
      <path d="M16.3 14c2.6.5 4.7 2.5 4.7 6" />
    </svg>
  );
}

export function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" />
    </svg>
  );
}

export function IconUserPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20c0-3.8 2.9-6.5 6.5-6.5s6.5 2.7 6.5 6.5" />
      <path d="M18 7.5v5M15.5 10h5" />
    </svg>
  );
}

export function IconMonitor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16.5V20" />
    </svg>
  );
}

export function IconClipboardCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  );
}

export function IconTrendLine() {
  // A rising line with solid dots at each data point — reads unmistakably as "a trend chart"
  // and the four filled dots give it roughly the same ink coverage as the donut icon below,
  // instead of relying on a single thin stroke to carry the whole shape.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16.5 8.5 11l4 3 7.5-8.5" />
      <circle cx="3" cy="16.5" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="11" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="14" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="20" cy="5.5" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconDonutChart() {
  // A bold ring with one solid quarter-wedge — every stroke and fill here is fully opaque
  // (no low-opacity "background" layer that disappears at small size, which is what made the
  // previous two attempts read as a thin fragment instead of a complete shape).
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12V3.5A8.5 8.5 0 0 1 19.86 9Z" fill="currentColor" fillOpacity="0.65" stroke="none" />
      <path d="M12 12V3.5M12 12l7.86-3" />
    </svg>
  );
}

export function IconAlertTriangle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 22 20H2Z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

export function IconActivity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 13h4l2.5-7 4 14 2.5-7h6" />
    </svg>
  );
}

export function IconBarChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 20V10M12 20V4M17 20v-7" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function IconLock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="11" width="15" height="10" rx="2" />
      <path d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11" />
    </svg>
  );
}

export function IconHeartPulse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h4l2-5 3 10 2.5-7 1.5 2h7" />
      <path d="M12 20.5C6 16.8 2.5 13.4 2.5 9.6 2.5 6.8 4.7 4.6 7.4 4.6c1.6 0 3.1.8 4 2.1a4.9 4.9 0 0 1 4.1-2.1c2.7 0 4.9 2.2 4.9 5 0 3.8-3.5 7.2-9.5 10.9Z" opacity="0.35" />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.2M12 18.8V21M4.2 12H2M22 12h-2.2M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </svg>
  );
}

export function IconMessageSquare() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M7.5 8.5h9M7.5 12.5h6" />
    </svg>
  );
}

export function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 15.3A8.7 8.7 0 0 1 8.7 3.5 8.7 8.7 0 1 0 20.5 15.3Z" />
    </svg>
  );
}

export function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

export function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconSort({ direction = 'none' }: { readonly direction?: 'none' | 'ascending' | 'descending' }) {
  let upOpacity = 0.55;
  let downOpacity = 0.55;
  if (direction === 'ascending') {
    upOpacity = 1;
    downOpacity = 0.24;
  } else if (direction === 'descending') {
    upOpacity = 0.24;
    downOpacity = 1;
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 9 4-4 4 4" opacity={upOpacity} />
      <path d="m8 15 4 4 4-4" opacity={downOpacity} />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
