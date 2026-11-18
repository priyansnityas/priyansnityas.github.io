# Pocket Ledger visual system

Pocket Ledger uses a calm, high-contrast surface system with a consistent top-left light source. The visual layer is presentation-only: it does not change transaction data, account calculations, or persistence.

## Tokens and elevations

Shared colors, spacing, radii, and shadows are CSS custom properties in `css/style.css`. Light and dark themes each define their own surface, text, edge, and shadow values so the dark theme is designed as its own palette. Green marks money in, red money out, blue investments, and amber/teal Udhar.

Four elevation tokens define the depth scale:

1. `--elevation-1`: pressable controls and chips.
2. `--elevation-2`: standard cards and list rows.
3. `--elevation-3`: hero cards, dialogs, and raised surfaces.
4. `--elevation-4`: floating navigation and top-level overlays.

Each elevation combines a subtle top-edge highlight, a near contact shadow, and a softer far shadow. Glass blur is progressive enhancement; solid surface colors remain the fallback. Visual Effects Lite removes blur, tilt, and the animated background. Reduced-motion preferences force Lite behavior.

## Adding a component

Use the existing surface tokens rather than a one-off shadow or color. Give the component a 16–24px radius, a 1px edge using `--line`/`--edge-highlight`, and the matching elevation token. Keep text on `--ink` or `--muted`, and use the semantic money colors only for meaning. Keep interactive targets at least 48px tall and add a visible `:focus-visible` style. Prefer SVG symbols from `assets/icons.svg`; use `currentColor` so an icon follows the component's semantic color. Add motion only to `transform` or `opacity`, and include the reduced-motion behavior. Test the component at 320–390px in both themes before expanding to larger layouts.
