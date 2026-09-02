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

export const Moon = () => (
  <svg {...box} aria-hidden="true">
    <rect x="6" y="2" width="6" height="2" />
    <rect x="4" y="4" width="2" height="8" />
    <rect x="6" y="12" width="6" height="2" />
    <rect x="10" y="4" width="2" height="2" />
    <rect x="10" y="10" width="2" height="2" />
    <rect x="2" y="6" width="2" height="4" />
  </svg>
)

export const Mic = () => (
  <svg {...box} aria-hidden="true">
    <rect x="6" y="1" width="4" height="7" />
    <rect x="3" y="7" width="2" height="2" />
    <rect x="11" y="7" width="2" height="2" />
    <rect x="5" y="9" width="6" height="2" />
    <rect x="7" y="11" width="2" height="3" />
    <rect x="4" y="14" width="8" height="2" />
  </svg>
)

export const Stop = () => (
  <svg {...box} aria-hidden="true">
    <rect x="4" y="4" width="8" height="8" />
  </svg>
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

export const Speaker = () => (
  <svg {...box} aria-hidden="true">
    <rect x="2" y="6" width="3" height="4" />
    <rect x="5" y="4" width="2" height="8" />
    <rect x="7" y="2" width="2" height="12" />
    <rect x="11" y="5" width="2" height="6" />
    <rect x="14" y="3" width="2" height="10" />
  </svg>
)
