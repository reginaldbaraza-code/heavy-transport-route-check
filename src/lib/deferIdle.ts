export function afterFirstPaintIdle(callback: () => void, timeout = 2200) {
  let outer = 0
  let inner = 0
  let idle = 0
  let timer = 0

  const start = () => {
    if (typeof requestIdleCallback === 'function') {
      idle = requestIdleCallback(callback, { timeout })
      return
    }
    timer = window.setTimeout(callback, 1)
  }

  outer = requestAnimationFrame(() => {
    inner = requestAnimationFrame(start)
  })

  return () => {
    cancelAnimationFrame(outer)
    cancelAnimationFrame(inner)
    if (idle && typeof cancelIdleCallback === 'function') cancelIdleCallback(idle)
    if (timer) window.clearTimeout(timer)
  }
}
