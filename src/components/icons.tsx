/** Pixel-flavoured inline icons — drawn on an 8px grid to match the type. */

const box = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'currentColor' } as const

export const Sun = () => (
  <svg {...box} aria-hidden="true">
    <rect x="6" y="6" width="4" height="4" />
    <rect x="7" y="1" width="2" height="2" />
    <rect x="7" y="13" width="2" height="2" />
    <rect x="1" y="7" width="2" height="2" />
    <rect x="13" y="7" width="2" height="2" />
    <rect x="3" y="3" width="2" height="2" />
    <rect x="11" y="11" width="2" height="2" />
    <rect x="11" y="3" width="2" height="2" />
    <rect x="3" y="11" width="2" height="2" />
  </svg>
)

// Raster asset, not an inline SVG like the rest of this file: it's a supplied
// reference image (transparent background, fixed dark-gray glyph). That's fine
// here specifically because this icon only ever renders while the page itself
// is in light mode (the button toggles *to* dark) — a light button background
// either way, so the fixed colour always has good contrast.
export const Moon = () => (
  <img src="/crescent.png" width={20} height={21} alt="" aria-hidden="true" style={{ display: 'block' }} />
)

export const Send = () => (
  <svg {...box} aria-hidden="true">
    <rect x="2" y="7" width="8" height="2" />
    <rect x="8" y="5" width="2" height="2" />
    <rect x="10" y="7" width="2" height="2" />
    <rect x="8" y="9" width="2" height="2" />
  </svg>
)

export const Command = () => (
  <svg {...box} aria-hidden="true">
    <rect x="2" y="2" width="4" height="2" />
    <rect x="2" y="4" width="2" height="2" />
    <rect x="10" y="2" width="4" height="2" />
    <rect x="12" y="4" width="2" height="2" />
    <rect x="6" y="6" width="4" height="4" />
    <rect x="2" y="12" width="4" height="2" />
    <rect x="2" y="10" width="2" height="2" />
    <rect x="10" y="12" width="4" height="2" />
    <rect x="12" y="10" width="2" height="2" />
  </svg>
)

export const Phone = () => (
  <svg {...box} aria-hidden="true">
    <rect x="3" y="2" width="4" height="4" />
    <rect x="9" y="10" width="4" height="4" />
    <rect x="5" y="6" width="2" height="2" />
    <rect x="7" y="8" width="2" height="2" />
    <rect x="9" y="9" width="2" height="2" />
  </svg>
)

export const Mail = () => (
  <svg {...box} aria-hidden="true">
    <rect x="1" y="3" width="14" height="2" />
    <rect x="1" y="3" width="2" height="10" />
    <rect x="13" y="3" width="2" height="10" />
    <rect x="1" y="11" width="14" height="2" />
    <rect x="3" y="5" width="2" height="2" />
    <rect x="11" y="5" width="2" height="2" />
    <rect x="5" y="7" width="2" height="2" />
    <rect x="9" y="7" width="2" height="2" />
    <rect x="7" y="8" width="2" height="2" />
  </svg>
)

export const Speaker = () => (
  <svg {...box} aria-hidden="true">
    <rect x="2" y="6" width="3" height="4" />
    <rect x="5" y="4" width="2" height="8" />
    <rect x="7" y="2" width="2" height="12" />
    <rect x="11" y="5" width="2" height="6" />
    <rect x="14" y="3" width="2" height="10" />
  </svg>
)
