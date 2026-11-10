import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

export { Toast } from './Toast'

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
