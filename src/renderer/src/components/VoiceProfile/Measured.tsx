import { useRef } from 'react'
import { useElementWidth } from '../../state/ui/useElementWidth'

/**
 * Draws a chart at the width it's given, one SVG unit to a pixel, so its labels stay at
 * the type scale's sizes however wide the dialog is. Nothing draws until it's measured.
 */
export function Measured({
  children
}: {
  children(width: number): React.ReactNode
}): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const width = useElementWidth(box)
  return (
    <div ref={box} className="voice-measured">
      {width > 0 && children(width)}
    </div>
  )
}
