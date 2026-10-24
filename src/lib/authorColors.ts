import { srgbToLinear } from './colors'

/**
 * One colour per author, from the Okabe-Ito palette (distinguishable with the common kinds of colour blindness).
 * Colour is never the only cue: names and shapes always go with it.
 */
const palette = ['#0072b2', '#d55e00', '#009e73', '#cc79a7', '#e69f00', '#56b4e9', '#f0e442', '#555555']

export function authorColor(index: number): string {
  return palette[index % palette.length]
}

/** The colour in the linear space that three.js vertex colours use. */
export function hexToLinear(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16)
  return [
    srgbToLinear(((value >> 16) & 255) / 255),
    srgbToLinear(((value >> 8) & 255) / 255),
    srgbToLinear((value & 255) / 255),
  ]
}
