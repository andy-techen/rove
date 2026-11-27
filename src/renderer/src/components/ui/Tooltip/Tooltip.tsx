import { ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { keyboardFocus } from '../../../state/ui/focusRing'
import './Tooltip.css'

interface Props {
  /** What the control does. Shown on hover or keyboard focus. */
  text: string
  /**
   * Formatted content shown in place of `text`, for help with a little structure (a
   * short list). `text` stays the plain version screen readers hear.
   */
  content?: ReactNode
  children: ReactNode
}

// Long enough not to flash while the pointer passes over; short enough to feel immediate.
const SHOW_DELAY_MS = 350
// Space between the control and its tooltip, and between the tooltip and the window edge.
const GAP_PX = 6
const EDGE_PX = 8

interface Place {
  left: number
  top: number
  /** Set when a wrapped tip is narrowed to its widest line. */
  width?: number
}

/**
 * The width that just fits a wrapped tip's lines. A box that wraps keeps its full max
 * width, leaving a gap beside shorter lines; balanced lines then fit a narrower box.
 * Undefined when the tip is one line, or the browser can't measure lines (tests).
 */
function fittedWidth(tip: HTMLElement): number | undefined {
  const range = document.createRange()
  range.selectNodeContents(tip)
  const lines = typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : []
  if (lines.length < 2) return undefined
  const style = getComputedStyle(tip)
  const inside = tip.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  const widest = Math.ceil(Math.max(...lines.map((line) => line.width)))
  return widest < inside ? tip.offsetWidth - inside + widest : undefined
}

/**
 * Where a tooltip renders. Normally the end of the page, so containers that clip their
 * content (the timeline) can't hide it. Inside a modal dialog it renders in the dialog:
 * the dialog sits in the browser's top layer, above anything else on the page however
 * high its z-index, and makes the rest of the page inert, so screen readers would
 * skip a description that lived outside it.
 */
const hostFor = (anchor: Element | null): Element =>
  anchor?.closest('dialog[open]') ?? document.body

/** Wraps a control and explains it on hover or focus. */
export function Tooltip({ text, content, children }: Props): React.JSX.Element {
  const id = useId()
  const anchor = useRef<HTMLSpanElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [host, setHost] = useState<Element | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const open = host !== null

  const show = (delay: number): void => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setHost(hostFor(anchor.current)), delay)
  }
  const hide = (): void => {
    clearTimeout(timer.current)
    setHost(null)
    setPlace(null)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  // Centre below the control; flip above near the bottom; stay inside the window.
  useLayoutEffect(() => {
    const target = anchor.current?.firstElementChild
    const tip = bubble.current
    if (!open || !target || !tip) return
    const r = target.getBoundingClientRect()
    const width = content ? undefined : fittedWidth(tip)
    if (width !== undefined) tip.style.width = `${width}px`
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    const below = r.bottom + GAP_PX
    const top = below + h + EDGE_PX > window.innerHeight ? r.top - GAP_PX - h : below
    const centred = r.left + r.width / 2 - w / 2
    const left = Math.max(EDGE_PX, Math.min(centred, window.innerWidth - w - EDGE_PX))
    setPlace({ left, top, width })
  }, [open, text, content])

  return (
    <>
      <span
        ref={anchor}
        className="tooltip-anchor"
        aria-describedby={open ? id : undefined}
        onPointerEnter={() => show(SHOW_DELAY_MS)}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={(e) => {
          if (keyboardFocus(e.target)) show(0)
        }}
        onBlur={hide}
      >
        {children}
      </span>
      {host &&
        createPortal(
          <div
            ref={bubble}
            id={id}
            role="tooltip"
            className={content ? 'tooltip tooltip-rich' : 'tooltip'}
            // Runtime geometry: measured against the control on screen.
            style={place ?? { visibility: 'hidden' }}
          >
            {content ?? text}
          </div>,
          host
        )}
    </>
  )
}
