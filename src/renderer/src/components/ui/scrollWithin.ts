const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Brings an item to the middle of the list that scrolls it, moving only that list.
 * (`scrollIntoView` would also scroll every container around it, pushing whole panels
 * out of place.) The list must be positioned (`position: relative`) so the item's
 * offset is measured from it. Not every DOM (jsdom) can scroll; then it does nothing.
 */
export function scrollWithin(list: HTMLElement | null, item: HTMLElement | null): void {
  if (!list || !item || typeof list.scrollTo !== 'function') return
  const top = item.offsetTop - (list.clientHeight - item.offsetHeight) / 2
  list.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}
