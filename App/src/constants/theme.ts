/**
 * Noti design tokens
 * Direction: Notes & Writing App — Minimalism / Swiss + Flat Design
 * Palette: warm paper cream + ink neutrals + indigo accent
 * Type: Inter (system fallbacks on native)
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1A1A1A',
    textSecondary: '#6B6B6B',
    textMuted: '#9A9A9A',
    background: '#FAF9F7',
    backgroundElement: '#F0EEE9',
    backgroundSelected: '#E6E3DC',
    card: '#FFFFFF',
    border: '#E5E2DB',
    primary: '#4F46E5',
    primaryForeground: '#FFFFFF',
    accent: '#818CF8',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    pin: '#F59E0B',
    tag: '#6366F1',
    link: '#2563EB',
    codeBg: '#F3F4F6',
    overlay: 'rgba(26, 26, 26, 0.45)',
  },
  dark: {
    text: '#F5F5F4',
    textSecondary: '#A8A29E',
    textMuted: '#78716C',
    background: '#0C0C0D',
    backgroundElement: '#1C1C1F',
    backgroundSelected: '#2A2A2E',
    card: '#161618',
    border: '#2E2E32',
    primary: '#818CF8',
    primaryForeground: '#0C0C0D',
    accent: '#A5B4FC',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    pin: '#FBBF24',
    tag: '#A5B4FC',
    link: '#93C5FD',
    codeBg: '#1F1F23',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif',
    mono: 'monospace',
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    serif: 'Georgia, serif',
    rounded: 'Inter, system-ui, sans-serif',
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
  eight: 64,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const Motion = {
  fast: 150,
  normal: 200,
  slow: 250,
} as const;

export const Typography = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  subtitle: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  callout: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4 },
};

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
export const TouchTarget = 44;
