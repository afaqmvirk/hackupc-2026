# Purple Pages Style Guide

## Brand Direction

Purple Pages is a modern, creative, digital-first brand system built around clarity, publishing, storytelling, and polished product experiences. The interface should feel premium, calm, structured, and expressive without becoming noisy.

The visual language combines a dark editorial UI foundation with vivid purple gradients, soft lavender highlights, thin borders, geometric page-like overlays, and clean sans-serif typography. Every screen should feel like part of a refined design system: precise spacing, consistent component states, subtle glow, and strong hierarchy.

## Core Principles

1. **Dark-first premium UI**  
   Use deep charcoal and near-black surfaces as the base. Purple should act as the main brand energy, not as a full-page background except in hero or marketing moments.

2. **Clarity over decoration**  
   Components should be easy to scan. Use generous spacing, crisp labels, and clear visual hierarchy.

3. **Purple as interaction language**  
   Use purple gradients and lavender accents for primary actions, active states, focus states, links, highlights, and important metrics.

4. **Editorial structure**  
   Layouts should feel like pages, panels, cards, and grids. The brand name suggests publishing, so visual motifs can include stacked pages, frames, document shapes, layered rectangles, and floating panels.

5. **Soft futuristic polish**  
   Use subtle glows, translucent overlays, gradient borders, and atmospheric purple lighting sparingly to create depth.

---

## Color System

### Primary Palette

```css
:root {
  --pp-purple-500: #7B3FF2;
  --pp-purple-400: #9D64F6;
  --pp-purple-700: #5B28C9;
  --pp-lavender-300: #C7B7FF;
  --pp-lavender-100: #E9E1FF;
  --pp-white: #F6F6FB;
}
```

### Dark Foundation

```css
:root {
  --pp-bg: #070912;
  --pp-bg-soft: #0B0E18;
  --pp-panel: #0D111D;
  --pp-panel-elevated: #111626;
  --pp-border: rgba(199, 183, 255, 0.14);
  --pp-border-strong: rgba(199, 183, 255, 0.28);
}
```

### Text Colors

```css
:root {
  --pp-text-primary: #F6F6FB;
  --pp-text-secondary: #C9C3DD;
  --pp-text-muted: #8E87A6;
  --pp-text-disabled: #5D5870;
}
```

### Semantic Colors

Use semantic colors only when necessary. Keep them slightly muted so they do not clash with the purple brand system.

```css
:root {
  --pp-success: #58D68D;
  --pp-warning: #F5B041;
  --pp-error: #FF6B7A;
  --pp-info: #8FA2FF;
}
```

### Gradients

Primary gradient:

```css
background: linear-gradient(135deg, #7B3FF2 0%, #9D64F6 100%);
```

Deep purple gradient:

```css
background: linear-gradient(135deg, #5B28C9 0%, #7B3FF2 55%, #C7B7FF 100%);
```

Ambient glow:

```css
background: radial-gradient(circle at 50% 0%, rgba(123, 63, 242, 0.28), transparent 55%);
```

---

## Typography

Use **Poppins** as the primary typeface. Fallbacks should be modern sans-serif.

```css
font-family: "Poppins", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Type Scale

| Token | Size | Weight | Usage |
|---|---:|---:|---|
| Display | 72px | 700 | Hero titles, major marketing moments |
| Headline | 48px | 600 | Page headers, campaign sections |
| Title | 28px | 600 | Card headings, modal titles |
| Body Large | 18px | 400 | Lead copy, important descriptions |
| Body | 16px | 400 | Default interface text |
| Body Small | 14px | 400 | Supporting text, metadata |
| Caption | 12px | 400 | Labels, helper text, small UI captions |

### Typography Rules

- Use tight but readable letter spacing for large headings.
- Use uppercase with wide tracking for section labels.
- Keep body text light gray, not pure white, for comfortable contrast.
- Use purple underline accents beneath important headings sparingly.

```css
.pp-section-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--pp-lavender-100);
}
```

---

## Layout System

### Grid

Use a consistent 8px spacing foundation. Larger page layouts should use modular panels and clear grid divisions.

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
  --space-32: 128px;
}
```

### Page Layout

- Use dark page backgrounds.
- Place content inside panels, cards, or constrained containers.
- Separate sections using thin borders or subtle dividers.
- Prefer 12-column grids for desktop layouts.
- Use generous vertical spacing between major sections.

### Border Radius

```css
:root {
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}
```

Use `10px–16px` for most components. Use larger radii for hero cards and feature panels.

---

## Surfaces & Panels

Panels should look refined and slightly dimensional.

```css
.pp-panel {
  background: linear-gradient(180deg, rgba(17, 22, 38, 0.96), rgba(11, 14, 24, 0.96));
  border: 1px solid var(--pp-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
}
```

### Glass / Floating Panels

Use for overlays, feature previews, abstract page elements, and hero visuals.

```css
.pp-glass {
  background: rgba(123, 63, 242, 0.12);
  border: 1px solid rgba(199, 183, 255, 0.22);
  backdrop-filter: blur(18px);
  box-shadow: 0 20px 60px rgba(91, 40, 201, 0.22);
}
```

---

## Buttons

### Primary Button

Use for the main action on a screen.

```css
.pp-button-primary {
  color: var(--pp-white);
  background: linear-gradient(135deg, var(--pp-purple-500), var(--pp-purple-400));
  border: 1px solid rgba(199, 183, 255, 0.24);
  border-radius: var(--radius-md);
  box-shadow: 0 10px 30px rgba(123, 63, 242, 0.32);
}

.pp-button-primary:hover {
  background: linear-gradient(135deg, var(--pp-purple-400), var(--pp-lavender-300));
  box-shadow: 0 14px 42px rgba(157, 100, 246, 0.38);
}

.pp-button-primary:active {
  background: var(--pp-purple-700);
}
```

### Secondary Button

Use for alternate actions.

```css
.pp-button-secondary {
  color: var(--pp-white);
  background: transparent;
  border: 1px solid var(--pp-purple-500);
  border-radius: var(--radius-md);
}

.pp-button-secondary:hover {
  background: rgba(123, 63, 242, 0.14);
  border-color: var(--pp-purple-400);
}
```

### Tertiary Button / Link Button

Use for quiet actions, card links, and inline navigation.

```css
.pp-button-tertiary {
  color: var(--pp-lavender-300);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--pp-purple-500);
}

.pp-button-tertiary:hover {
  color: var(--pp-white);
  border-bottom-color: var(--pp-lavender-300);
}
```

### Disabled State

```css
.pp-button:disabled {
  color: var(--pp-text-disabled);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
  cursor: not-allowed;
}
```

---

## Forms & Inputs

Inputs should be dark, quiet, and precise with purple focus states.

```css
.pp-input {
  width: 100%;
  color: var(--pp-text-primary);
  background: rgba(7, 9, 18, 0.72);
  border: 1px solid var(--pp-border-strong);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  outline: none;
}

.pp-input::placeholder {
  color: var(--pp-text-muted);
}

.pp-input:focus {
  border-color: var(--pp-purple-400);
  box-shadow: 0 0 0 4px rgba(123, 63, 242, 0.16);
}
```

### Form Rules

- Labels should be small, uppercase, and muted.
- Helper text should use `--pp-text-muted`.
- Error text should use `--pp-error` with a subtle error border.
- Avoid heavy form shadows.

---

## Cards

Cards should combine structured content with subtle depth.

```css
.pp-card {
  background: linear-gradient(180deg, rgba(17, 22, 38, 0.92), rgba(11, 14, 24, 0.94));
  border: 1px solid var(--pp-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.28);
}

.pp-card:hover {
  border-color: rgba(199, 183, 255, 0.34);
  box-shadow: 0 24px 90px rgba(91, 40, 201, 0.2);
}
```

### Card Content Pattern

- Small uppercase category label in purple.
- Strong white title.
- Muted body copy.
- Purple text link or arrow action.
- Optional abstract purple page/media visual.

---

## Iconography

Use thin, minimal outlined icons. Recommended libraries: `lucide-react`, `phosphor-react`, or custom SVGs.

Icon rules:

- Stroke width: `1.5px–2px`.
- Default icon color: `--pp-lavender-300` or `--pp-text-secondary`.
- Active icon color: `--pp-purple-400`.
- Icons should be geometric, simple, and rounded.
- Avoid filled icons unless used inside stat badges or active states.

```css
.pp-icon {
  color: var(--pp-lavender-300);
  stroke-width: 1.75;
}
```

---

## Navigation

Navigation should be clean and understated.

- Use dark transparent backgrounds.
- Active links should use purple text, underline, glow, or pill background.
- Hover states should softly brighten text.
- Avoid large heavy nav containers unless used for dashboards.

```css
.pp-nav-link {
  color: var(--pp-text-secondary);
  transition: color 160ms ease, background 160ms ease;
}

.pp-nav-link:hover,
.pp-nav-link[data-active="true"] {
  color: var(--pp-white);
  background: rgba(123, 63, 242, 0.12);
}
```

---

## Dividers & Accents

Use thin lines to preserve the brandbook-style grid.

```css
.pp-divider {
  height: 1px;
  background: var(--pp-border);
}

.pp-accent-line {
  height: 2px;
  background: linear-gradient(90deg, var(--pp-purple-500), var(--pp-lavender-300));
}
```

Accent line variants:

- Solid gradient line for emphasis.
- Dashed purple line for secondary visual rhythm.
- Dotted purple line for decorative separators.

---

## Motion

Motion should be smooth, subtle, and product-like.

### Timing

```css
:root {
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-slow: 320ms;
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

### Motion Rules

- Buttons lift slightly on hover.
- Cards can rise by `2px–4px` on hover.
- Modals and panels should fade and scale in gently.
- Avoid bouncy or cartoon-like animation.
- Use glowing effects only on primary actions or hero elements.

```css
.pp-hover-lift {
  transition: transform var(--motion-base) var(--ease-standard), box-shadow var(--motion-base) var(--ease-standard);
}

.pp-hover-lift:hover {
  transform: translateY(-3px);
}
```

---

## Imagery & Illustration

Purple Pages imagery should feel digital, editorial, layered, and luminous.

Recommended visual motifs:

- Abstract stacked pages.
- Floating translucent panels.
- Purple-lit rooms or portals.
- Layered rectangles and frames.
- Document, publishing, template, and page-builder metaphors.
- Soft violet lighting over deep black backgrounds.

Avoid:

- Stock photography that feels generic.
- Warm orange/yellow-heavy palettes.
- Busy illustrations with too many colors.
- Cartoonish mascots.

---

## Data & Stats

Stats should be shown in compact cards with clear numbers and muted labels.

```css
.pp-stat {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid var(--pp-border);
  border-radius: var(--radius-md);
  padding: 20px;
}

.pp-stat-value {
  color: var(--pp-white);
  font-size: 28px;
  font-weight: 600;
}

.pp-stat-label {
  color: var(--pp-text-muted);
  font-size: 13px;
}
```

Use small purple icon badges above or beside stat values.

---

## Quotes & Testimonials

Quotes should feel editorial and refined.

```css
.pp-quote-mark {
  color: var(--pp-purple-500);
  font-size: 48px;
  line-height: 1;
}

.pp-quote-text {
  color: var(--pp-text-secondary);
  font-size: 18px;
  line-height: 1.6;
}

.pp-quote-author {
  color: var(--pp-purple-400);
  font-size: 14px;
}
```

---

## Accessibility

- Maintain strong contrast between text and dark surfaces.
- Do not place lavender text on bright purple backgrounds unless contrast is checked.
- Focus states must be visible and consistent.
- Interactive elements should have at least `44px` touch target height.
- Do not communicate state with color only; use icons, labels, or borders too.
- Respect reduced-motion preferences.

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## React Project Implementation

### Recommended Token Structure

Create a design token file:

```ts
export const colors = {
  purple: {
    400: "#9D64F6",
    500: "#7B3FF2",
    700: "#5B28C9",
  },
  lavender: {
    100: "#E9E1FF",
    300: "#C7B7FF",
  },
  neutral: {
    bg: "#070912",
    bgSoft: "#0B0E18",
    panel: "#0D111D",
    panelElevated: "#111626",
    white: "#F6F6FB",
  },
};
```

### Tailwind Theme Extension

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        pp: {
          bg: "#070912",
          soft: "#0B0E18",
          panel: "#0D111D",
          elevated: "#111626",
          purple: "#7B3FF2",
          violet: "#9D64F6",
          deep: "#5B28C9",
          lavender: "#C7B7FF",
          lilac: "#E9E1FF",
          white: "#F6F6FB",
        },
      },
      fontFamily: {
        sans: ["Poppins", "Inter", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        glow: "0 20px 60px rgba(123, 63, 242, 0.28)",
        panel: "0 24px 80px rgba(0, 0, 0, 0.35)",
      },
      borderRadius: {
        xl: "24px",
      },
    },
  },
};
```

### Component Naming

Use clear component names that reflect the system:

- `PrimaryButton`
- `SecondaryButton`
- `PagePanel`
- `GlassPanel`
- `FeatureCard`
- `StatCard`
- `SectionLabel`
- `PurplePagesLogo`
- `AccentLine`
- `PagePreviewCard`

---

## Example Component Style

```tsx
export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-pp-lavender/25 bg-gradient-to-br from-pp-purple to-pp-violet px-5 py-2.5 font-medium text-pp-white shadow-glow transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:pointer-events-none disabled:opacity-45"
    >
      {children}
    </button>
  );
}
```

---

## Do / Don’t

### Do

- Use dark backgrounds with purple accents.
- Use clean panels and modular grids.
- Use gradient buttons for primary actions.
- Use Poppins or a similar geometric sans-serif.
- Use subtle page-inspired graphics.
- Keep UI states consistent across components.

### Don’t

- Overuse bright purple as a full-screen background.
- Mix in unrelated bright colors.
- Use heavy, thick borders.
- Use cartoon illustrations or playful fonts.
- Use inconsistent spacing.
- Hide focus states.

---

## Brand Voice in UI Copy

Purple Pages copy should sound clear, confident, and creative.

Recommended phrases:

- “Create. Publish. Make an impact.”
- “Design that connects.”
- “Clarity in every page.”
- “Build. Share. Inspire.”
- “Beautiful templates. Powerful tools.”
- “Share with purpose.”

Avoid overly technical, cold, or corporate phrasing unless required by product context.

---

## Final Visual Target

A Purple Pages interface should look like a premium dark design system for a creative publishing platform: structured like a professional brandbook, energized by violet gradients, softened by lavender highlights, and grounded in clean typography, precise spacing, and confident UI patterns.
