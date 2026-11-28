// jsdom has no layout, so nothing ever scrolls into view. This fake remembers what's
// observed, and tests say when it comes into view with `scrollIntoView()`.

const observers = new Set<FakeIntersectionObserver>()

class FakeIntersectionObserver {
  private targets = new Set<Element>()
  constructor(private callback: IntersectionObserverCallback) {
    observers.add(this)
  }
  observe(target: Element): void {
    this.targets.add(target)
  }
  unobserve(target: Element): void {
    this.targets.delete(target)
  }
  disconnect(): void {
    this.targets.clear()
    observers.delete(this)
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  reveal(target: Element): void {
    if (!this.targets.has(target)) return
    const entry = { target, isIntersecting: true } as IntersectionObserverEntry
    this.callback([entry], this as unknown as IntersectionObserver)
  }
}

export function installIntersectionObserver(): void {
  globalThis.IntersectionObserver ??=
    FakeIntersectionObserver as unknown as typeof IntersectionObserver
}

/** Tells every observer watching `target` that it scrolled into view. */
export function scrollIntoView(target: Element): void {
  for (const observer of [...observers]) observer.reveal(target)
}
