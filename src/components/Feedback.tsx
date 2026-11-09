import { useCallback, useEffect, useRef } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

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
  return (
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
    </div>
  )
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel() }}>
      <DialogContent
        className="confirm-dialog sm:max-w-md"
        showCloseButton={false}
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        <div className={`confirm-dialog-icon ${destructive ? 'danger' : ''}`}><AlertTriangle size={19} /></div>
        <DialogHeader>
          <DialogTitle id="confirm-title">{title}</DialogTitle>
          <DialogDescription id="confirm-description">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="confirm-dialog-actions">
          <Button type="button" variant="outline" onClick={onCancel} autoFocus>Cancel</Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
