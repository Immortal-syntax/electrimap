// Copyright 2026 Swayam Kumar
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { Button, IconButton } from './Button'

export type DialogSize = 'sm' | 'md' | 'lg'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  overline?: string
  size?: DialogSize
  footer?: React.ReactNode
  children?: React.ReactNode
}

const DIALOG_SIZE_CLASSES: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

/**
 * Accessible modal dialog (`role="dialog"`, `aria-modal="true"`).
 * Handles Escape key dismissal, backdrop click, and initial focus placement.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  overline,
  size = 'md',
  footer,
  children,
}: DialogProps) {
  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const previousFocused = document.activeElement as HTMLElement | null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    dialogRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/55 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`w-full ${DIALOG_SIZE_CLASSES[size]} bg-sheet border border-rule rounded-lg shadow-overlay overflow-hidden focus:outline-none`}
      >
        <header className="px-5 py-4 bg-subtle/60 border-b border-rule-subtle flex items-start justify-between gap-3">
          <div className="min-w-0">
            {overline && <div className="heading-overline mb-0.5">{overline}</div>}
            <h2 id={titleId} className="text-sm font-semibold text-ink tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-xs text-ink-3 mt-0.5">
                {description}
              </p>
            )}
          </div>
          <IconButton
            icon={X}
            size="sm"
            variant="ghost"
            aria-label="Close dialog"
            onClick={onClose}
          />
        </header>

        {children && <div className="p-4 text-body-sm text-ink space-y-3">{children}</div>}

        {footer && (
          <footer className="px-4 py-2.5 bg-subtle border-t border-rule flex items-center justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-xs text-ink-2 leading-relaxed">{description}</div>
    </Dialog>
  )
}

