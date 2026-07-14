/**
 * Mental Wealth Academy Design Tokens
 * 
 * TypeScript references for the CSS design system. Color values resolve through
 * styles/color-system.css, the runtime source of truth.
 * 
 * @see styles/color-system.css
 */

// ============================================
// Color Tokens
// ============================================

/**
 * Brand Colors - Core palette for Mental Wealth Academy
 */
export const colors = {
  // Primary Colors
  primary: {
    DEFAULT: 'var(--color-action)',
    hover: 'var(--color-action-hover)',
    muted: 'var(--color-action-muted)',
    light: 'var(--color-action-muted)',
    dark: 'var(--color-action-hover)',
  },
  
  // Secondary Colors
  secondary: {
    DEFAULT: 'var(--color-positive)',
    hover: 'var(--color-positive-hover)',
    muted: 'var(--color-positive-muted)',
    light: 'var(--color-positive-muted)',
    dark: 'var(--color-positive-hover)',
  },
  
  // Background Colors
  background: {
    DEFAULT: 'var(--color-background)',
    card: 'var(--color-surface-1)',
    dark: 'var(--color-background)',
    cardDark: 'var(--color-surface-1)',
    surfaceDark: 'var(--color-surface-2)',
    surfaceDarkRaised: 'var(--color-surface-3)',
  },
  
  // Neutral Colors (Gray Scale)
  neutrals: {
    white: 'var(--color-text-light)',
    50: 'var(--color-canvas)',
    100: 'var(--color-surface-1)',
    200: 'var(--color-surface-2)',
    300: 'var(--color-surface-3)',
    400: 'var(--color-text-faint)',
    500: 'var(--color-text-muted)',
    600: 'var(--color-text-soft)',
    700: 'var(--color-text-dark)',
    800: 'var(--color-text-dark)',
    900: 'var(--color-text-dark)',
    black: 'var(--color-text-dark)',
  },
  
  // Text Colors
  text: {
    dark: 'var(--color-text-dark)',
    light: 'var(--color-text-light)',
    muted: 'var(--color-text-muted)',
    soft: 'var(--color-text-soft)',
    faint: 'var(--color-text-faint)',
    foreground: 'var(--color-text-dark)',
    secondary: 'var(--color-text-soft)',
    // Dark mode variants
    foregroundDark: 'var(--color-text-dark)',
    secondaryDark: 'var(--color-text-soft)',
    mutedDark: 'var(--color-text-muted)',
    faintDark: 'var(--color-text-faint)',
  },
  
  // Semantic Colors
  semantic: {
    success: {
      DEFAULT: 'var(--color-positive)',
      light: 'var(--color-positive-muted)',
      dark: 'var(--color-positive-hover)',
      muted: 'var(--color-positive-muted)',
    },
    warning: {
      DEFAULT: 'var(--color-warning)',
      light: 'color-mix(in srgb, var(--color-warning) 18%, transparent)',
      dark: 'var(--color-warning)',
      muted: 'color-mix(in srgb, var(--color-warning) 18%, transparent)',
    },
    error: {
      DEFAULT: 'var(--color-danger)',
      light: 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
      dark: 'var(--color-danger)',
      muted: 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
    },
    info: {
      DEFAULT: 'var(--color-action)',
      light: 'var(--color-action-muted)',
      dark: 'var(--color-action-hover)',
      muted: 'var(--color-action-muted)',
    },
  },
  
  // Category Colors
  category: {
    mentalHealth: 'var(--color-accent)',
    productivity: 'var(--color-action)',
    wealth: 'var(--color-positive)',
  },

  // Border Colors
  border: {
    DEFAULT: 'var(--color-border-subtle)',
    subtle: 'var(--color-border-subtle)',
    card: 'var(--color-border-subtle)',
    subtleDark: 'var(--color-border-subtle)',
    strongDark: 'var(--color-border-strong)',
  },
} as const;

/**
 * Brand Colors (exported as named tokens for API compatibility)
 */
export const gradients = {
  futuristicFloss: 'var(--color-canvas)',
  primary: colors.primary.DEFAULT,
  secondary: colors.secondary.DEFAULT,
  darkFuturisticFloss: 'var(--color-background)',
  darkPrimary: 'var(--color-action)',
  darkSecondary: 'var(--color-positive)',
  swipeLike: colors.secondary.DEFAULT,
  swipeSkip: 'var(--color-danger)',
  swipeSave: colors.primary.DEFAULT,
} as const;

// ============================================
// Typography Tokens
// ============================================

/**
 * Font Families
 */
export const fontFamilies = {
  primary: "'Poppins', sans-serif",
  secondary: "'Space Grotesk', sans-serif",
  mono: "'Commit Mono', monospace",
} as const;

/**
 * Font Weights
 */
export const fontWeights = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Font Sizes - Golden Ratio Scale (φ = 1.618)
 * Harmonious typographic proportions
 */
export const fontSizes = {
  xs: '0.618rem',      // ~10px: base ÷ φ
  sm: '0.75rem',       // ~12px: base ÷ (φ × 0.85)
  base: '0.875rem',    // 14px - Body text baseline (maintained)
  md: '1rem',          // 16px - Comfortable reading
  lg: '1.125rem',      // ~18px: base × 1.125
  xl: '1.618rem',      // ~26px: base × φ
  '2xl': '2.618rem',   // ~42px: base × φ²
  '3xl': '4.236rem',   // ~68px: base × φ³
  '4xl': '6.854rem',   // ~110px: base × φ⁴
  '5xl': '11.09rem',   // ~177px: base × φ⁵
} as const;

/**
 * Line Heights
 */
export const lineHeights = {
  none: 1,
  tight: 1.2,       // Headings
  snug: 1.4,
  normal: 1.5,
  relaxed: 1.6,     // Body text
  loose: 1.75,
} as const;

/**
 * Letter Spacing
 */
export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.02em',   // Headlines
  normal: '0em',
  wide: '0.025em',
  wider: '0.05em',    // Buttons, uppercase
  widest: '0.1em',
} as const;

/**
 * Typography Presets - Ready-to-use text styles
 * Updated to use golden ratio-based font sizes
 */
export const typography = {
  h1: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes['3xl'],     // ~68px (φ³)
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontFamily: fontFamilies.secondary,
    fontSize: fontSizes['2xl'],     // ~42px (φ²)
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontFamily: fontFamilies.secondary,
    fontSize: fontSizes.xl,         // ~26px (φ)
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.tight,
  },
  h4: {
    fontFamily: fontFamilies.secondary,
    fontSize: fontSizes.lg,         // ~18px
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
  },
  h5: {
    fontFamily: fontFamilies.secondary,
    fontSize: fontSizes.md,         // 16px
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.snug,
  },
  h6: {
    fontFamily: fontFamilies.secondary,
    fontSize: fontSizes.base,       // 14px
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.snug,
  },
  body: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.base,       // 14px
    fontWeight: fontWeights.light,
    lineHeight: lineHeights.relaxed,
  },
  bodyLarge: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.md,         // 16px
    fontWeight: fontWeights.light,
    lineHeight: lineHeights.relaxed,
  },
  bodySmall: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.sm,         // ~12px
    fontWeight: fontWeights.light,
    lineHeight: lineHeights.relaxed,
  },
  caption: {
    fontFamily: fontFamilies.primary,
    fontSize: fontSizes.xs,         // ~10px (÷φ)
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.normal,
  },
  button: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.base,       // 14px
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wider,
    textTransform: 'none' as const,
  },
  mono: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.base,       // 14px
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.normal,
    fontVariantNumeric: 'tabular-nums',
  },
} as const;

// ============================================
// Spacing Tokens (Golden Ratio Scale - φ = 1.618)
// ============================================

/**
 * Spacing Scale - Based on Golden Ratio
 * Provides harmonious proportions throughout the design
 */
export const spacing = {
  px: '1px',
  0: '0',
  
  // Golden ratio progression
  '3xs': '0.375rem',   // ~6px: φ⁻³
  '2xs': '0.5rem',     // ~8px
  xs: '0.625rem',      // ~10px: φ⁻²
  sm: '1rem',          // 16px: φ⁻¹ (base)
  md: '1.625rem',      // ~26px: φ⁰
  lg: '2.625rem',      // ~42px: φ¹
  xl: '4.25rem',       // ~68px: φ²
  '2xl': '6.875rem',   // ~110px: φ³
  
  // Legacy numeric scale (maintained for compatibility)
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px - Micro spacing
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px - Tight spacing
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px - Standard spacing
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px - Comfortable spacing
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px - Generous spacing
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px - Major separation
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  11: '2.75rem',     // 44px
  12: '3rem',        // 48px - Large section breaks
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px - Hero spacing
  20: '5rem',        // 80px
  24: '6rem',        // 96px
  28: '7rem',        // 112px
  32: '8rem',        // 128px
  36: '9rem',        // 144px
  40: '10rem',       // 160px
  44: '11rem',       // 176px
  48: '12rem',       // 192px
  52: '13rem',       // 208px
  56: '14rem',       // 224px
  60: '15rem',       // 240px
  64: '16rem',       // 256px
  72: '18rem',       // 288px
  80: '20rem',       // 320px
  96: '24rem',       // 384px
} as const;

// ============================================
// Border Radius Tokens (Golden Ratio Scale)
// ============================================

/**
 * Border Radius Scale - Golden Ratio Progression
 * Harmonious rounding for visual consistency
 */
export const borderRadius = {
  none: '0',
  sm: '0.25rem',     // 4px - Tags, badges, small chips
  DEFAULT: '0.375rem', // 6px
  md: '0.5rem',      // 8px - Buttons, inputs, small cards (φ-based)
  lg: '0.75rem',     // 12px - Standard cards, modals
  xl: '1.25rem',     // 20px - Hero cards, featured content (φ-based)
  '2xl': '2rem',     // 32px - Large containers (φ-based)
  '3xl': '3.25rem',  // 52px - Extra large elements (φ-based)
  full: '9999px',    // Pills, avatars, status indicators
} as const;

// ============================================
// Shadow Tokens
// ============================================

/**
 * Shadow Definitions - Subtle single shadows with border reinforcement
 */
export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  DEFAULT: '0 2px 4px rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px rgba(0, 0, 0, 0.07)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.12)',
  xl: '0 16px 48px rgba(0, 0, 0, 0.15)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
  
  // Brand shadows with primary color
  primary: '0 4px 12px rgba(81, 104, 255, 0.3)',
  primaryHover: '0 6px 16px rgba(81, 104, 255, 0.4)',
  secondary: '0 4px 12px rgba(80, 89, 155, 0.3)',
  secondaryHover: '0 6px 16px rgba(80, 89, 155, 0.4)',
  
  // Card shadows
  card: '0 4px 16px rgba(81, 104, 255, 0.08)',
  cardHover: '0 8px 24px rgba(81, 104, 255, 0.15)',
  
  // Inner shadow
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
} as const;

// ============================================
// Breakpoints (Responsive Design)
// ============================================

/**
 * Breakpoint Values - Mobile-first approach
 */
export const breakpoints = {
  xs: '320px',       // Small phones
  sm: '480px',       // Large phones
  md: '768px',       // Tablets
  lg: '1024px',      // Laptops
  xl: '1280px',      // Desktops
  '2xl': '1536px',   // Large desktops
} as const;

/**
 * Media Query Helpers
 */
export const mediaQueries = {
  xs: `@media (min-width: ${breakpoints.xs})`,
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  '2xl': `@media (min-width: ${breakpoints['2xl']})`,
  // Max-width queries for specific overrides
  maxXs: `@media (max-width: ${breakpoints.xs})`,
  maxSm: `@media (max-width: ${breakpoints.sm})`,
  maxMd: `@media (max-width: ${breakpoints.md})`,
  maxLg: `@media (max-width: ${breakpoints.lg})`,
  maxXl: `@media (max-width: ${breakpoints.xl})`,
} as const;

// ============================================
// Animation Tokens
// ============================================
// Runtime source of truth is styles/globals.css (:root custom properties);
// see docs/design-system/motion.md for the full rules. Rule of thumb:
// never ship "linear" or an unnamed default easing except on continuous
// loops (marquees/spinners) — use `out` for things entering, `in` for
// things leaving, `default` for everything else, and keep interface
// transition durations between `fast` (150ms) and `slow` (300ms).

/**
 * Animation Durations
 */
export const durations = {
  instant: 'var(--duration-instant)',  // 50ms — near-imperceptible feedback only
  fast: 'var(--duration-fast)',        // 150ms — micro-interactions (hover, focus, toggles)
  normal: 'var(--duration-normal)',    // 250ms — standard UI moves (cards, dropdowns, tabs)
  slow: 'var(--duration-slow)',        // 300ms — upper bound for interface transitions
  slower: 'var(--duration-slower)',    // 500ms — large, rare, non-interface reveals only
  swipe: 'var(--duration-slow)',       // Swipe card gamification
} as const;

/**
 * Easing Curves
 */
export const easings = {
  default: 'var(--ease-default)',  // fast start, soft landing — UI moves in place
  in: 'var(--ease-in)',            // things leaving
  out: 'var(--ease-out)',          // things entering
  inOut: 'var(--ease-in-out)',
  bounce: 'var(--ease-bounce)',
  spring: 'var(--ease-spring)',
  linear: 'var(--ease-linear)',    // marquee/spinner continuous loops only
} as const;

/**
 * Transition Presets
 */
export const transitions = {
  fast: `all ${durations.fast} ${easings.default}`,
  normal: `all ${durations.normal} ${easings.default}`,
  slow: `all ${durations.slow} ${easings.default}`,
  bounce: `all ${durations.normal} ${easings.bounce}`,
  spring: `all ${durations.normal} ${easings.spring}`,
} as const;

// ============================================
// Z-Index Scale
// ============================================

/**
 * Z-Index Layers
 */
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  card: 10,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  tooltip: 600,
  toast: 700,
  max: 9999,
} as const;

// ============================================
// Component Tokens
// ============================================

/**
 * Card Styles
 */
export const card = {
  background: colors.background.card,
  border: `1px solid ${colors.border.card}`,
  borderAccent: '0.5px solid rgba(0, 0, 0, 0.08)',
  radius: borderRadius.xl,
  padding: spacing[4],
  shadow: shadows.card,
  shadowHover: shadows.cardHover,
  transition: `box-shadow ${durations.normal} ${easings.out}, transform ${durations.normal} ${easings.out}`,
} as const;

/**
 * Button Styles
 */
export const button = {
  fontFamily: fontFamilies.mono,
  fontWeight: fontWeights.medium,
  letterSpacing: letterSpacing.wider,
  textTransform: 'none' as const,
  paddingX: spacing[6],
  paddingY: spacing[3],
  borderRadius: borderRadius.sm,
  transition: transitions.normal,
} as const;

/**
 * Input Styles
 */
export const input = {
  fontFamily: fontFamilies.primary,
  fontSize: fontSizes.base,
  paddingX: spacing[4],
  paddingY: spacing[3],
  borderRadius: borderRadius.md,
  borderColor: colors.border.DEFAULT,
  focusBorderColor: colors.primary.DEFAULT,
  transition: transitions.fast,
} as const;

// ============================================
// Export All Tokens
// ============================================

export const designTokens = {
  colors,
  gradients,
  fontFamilies,
  fontWeights,
  fontSizes,
  lineHeights,
  letterSpacing,
  typography,
  spacing,
  borderRadius,
  shadows,
  breakpoints,
  mediaQueries,
  durations,
  easings,
  transitions,
  zIndex,
  card,
  button,
  input,
} as const;

export type DesignTokens = typeof designTokens;

export default designTokens;
