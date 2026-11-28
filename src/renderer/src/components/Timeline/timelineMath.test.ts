import { describe, expect, it } from 'vitest'
import { MAX_PX_PER_SEC } from './constants'
import {
  followPlayhead,
  formatTick,
  minorStep,
  pickTickStep,
  tickTimes,
  timelineLength,
  zoomAround
} from './timelineMath'

describe('pickTickStep', () => {
  it('uses one-second ticks when zoomed in', () => {
    expect(pickTickStep(100)).toBe(1)
  })

  it('widens ticks so labels never crowd', () => {
    expect(pickTickStep(5)).toBe(15)
    expect(pickTickStep(1)).toBe(120)
  })

  it('labels tenths of a second when zoomed all the way in', () => {
    expect(pickTickStep(400)).toBe(0.2)
    expect(formatTick(65.4, 0.2)).toBe('1:05.4')
    expect(formatTick(65.4, 1)).toBe('1:05')
  })

  it('puts finer marks between labels, landing exactly on round times', () => {
    expect(minorStep(1)).toBe(0.2)
    expect(tickTimes(0.25, 1, 0.2)).toEqual([0.2, 0.4, 0.6, 0.8, 1])
  })

  it('caps at the largest step for very long songs', () => {
    expect(pickTickStep(0.01)).toBe(300)
  })
})

describe('timelineLength', () => {
  it('shows at least 30 seconds for an empty song', () => {
    expect(timelineLength([])).toBe(30)
  })

  it('adds a little room after the longest item', () => {
    expect(timelineLength([200, 100])).toBe(210)
  })
})

describe('zoomAround', () => {
  // A 100 s song fitted into 1000 px: 10 px per second.
  const fit = 10
  it('keeps the moment under the cursor in place', () => {
    const view = zoomAround({ zoom: 1, scrollX: 0 }, fit, 100, 1000, 500, 4)
    expect(view.zoom).toBe(4)
    // 50 s was under the cursor; at 40 px/s it sits at 2000 px, still 500 px into the view.
    expect(view.scrollX).toBe(1500)
  })

  it('never zooms out past fitting the whole song', () => {
    expect(zoomAround({ zoom: 2, scrollX: 300 }, fit, 100, 1000, 0, 0.1)).toEqual({
      zoom: 1,
      scrollX: 0
    })
  })

  it('caps the zoom at the finest useful detail', () => {
    const view = zoomAround({ zoom: 1, scrollX: 0 }, fit, 100, 1000, 0, 1000)
    expect(view.zoom * fit).toBe(MAX_PX_PER_SEC)
  })

  it('does not scroll past the end of the song', () => {
    const view = zoomAround({ zoom: 1, scrollX: 0 }, fit, 100, 1000, 1000, 2)
    expect(view.scrollX).toBe(1000)
  })
})

describe('followPlayhead', () => {
  it('leaves the view alone while the playhead is on screen', () => {
    expect(followPlayhead(500, 0, 1000)).toBe(0)
  })

  it('pages ahead when the playhead nears the right edge', () => {
    expect(followPlayhead(950, 0, 1000)).toBe(850)
  })

  it('jumps back when the playhead is left of the view', () => {
    expect(followPlayhead(100, 2000, 1000)).toBe(0)
  })
})
