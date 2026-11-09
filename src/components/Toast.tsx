import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

export function Toast({
  message,
  tone = 'success',
  onClose,
}: {
  message: string
  tone?: 'success' | 'info' | 'warning'
  onClose: () => void
}) {
  const onCloseRef = useRef(onClose)
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const remainingRef = useRef(4000)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()
    startedAtRef.current = Date.now()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      onCloseRef.current()
    }, remainingRef.current)
  }, [clearTimer])

  useEffect(() => {
    remainingRef.current = 4000
    startTimer()
    return clearTimer
  }, [clearTimer, message, startTimer])

  const pauseTimer = () => {
    if (timerRef.current === null) return
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current))
    clearTimer()
  }

  const resumeTimer = () => {
    if (timerRef.current !== null) return
    if (remainingRef.current <= 0) {
      onCloseRef.current()
      return
    }
    startTimer()
  }

  const dismiss = () => {
    clearTimer()
    onCloseRef.current()
  }

  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : Info
  return createPortal(
    <div
      className={`app-toast ${tone}`}
      role="status"
      aria-live="polite"
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
    >
      <Icon size={17} />
      <span>{message}</span>
      <button type="button" onClick={dismiss} aria-label="Dismiss notification"><X size={14} /></button>
    </div>,
    document.body,
  )
}
