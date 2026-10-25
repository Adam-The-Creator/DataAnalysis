export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface Placement {
  left: number
  top: number
  side: 'above' | 'below'
}

/**
 * Where a tooltip goes, in viewport coordinates (it is drawn with position: fixed): centred on its trigger, above it
 * when there is room, below it otherwise, and always kept `margin` pixels inside the viewport so that no part of the text
 * is cut off at an edge. When neither side has room the side with more space is used and the tooltip is pushed into view.
 */
export function placeTooltip(trigger: Box, tip: Size, viewport: Size, gap = 8, margin = 8): Placement {
  const centre = trigger.left + trigger.width / 2
  const maxLeft = Math.max(margin, viewport.width - margin - tip.width)
  const left = Math.min(Math.max(centre - tip.width / 2, margin), maxLeft)

  const roomAbove = trigger.top - gap - margin
  const roomBelow = viewport.height - (trigger.top + trigger.height) - gap - margin
  const above = roomAbove >= tip.height || (roomBelow < tip.height && roomAbove >= roomBelow)
  const wanted = above ? trigger.top - gap - tip.height : trigger.top + trigger.height + gap
  const maxTop = Math.max(margin, viewport.height - margin - tip.height)
  return { left, top: Math.min(Math.max(wanted, margin), maxTop), side: above ? 'above' : 'below' }
}
