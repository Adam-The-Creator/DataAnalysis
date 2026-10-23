import type { LineColor } from '@/api/types'

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')

export function rgbToHex(color: Pick<LineColor, 'r' | 'g' | 'b'>): string {
  return `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`
}

/** sRGB (0..1) to linear, which is what three.js vertex colours expect. */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Hue in degrees (0..360) and whether the colour has any saturation worth talking about. */
export function hueOf(color: Pick<LineColor, 'r' | 'g' | 'b'>): { hue: number; chromatic: boolean } {
  const { r, g, b } = color
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta < 25) {
    return { hue: 0, chromatic: false }
  }
  let hue: number
  if (max === r) {
    hue = ((g - b) / delta) % 6
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }
  return { hue: (hue * 60 + 360) % 360, chromatic: true }
}

/** Red, orange and yellow, and the magentas next to red, count as warm. */
export function isWarmHue(hue: number): boolean {
  return hue < 70 || hue >= 300
}
