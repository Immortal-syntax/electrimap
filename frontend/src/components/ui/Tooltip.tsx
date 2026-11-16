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

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BEGINNER_GLOSSARY, type GlossaryKey } from '../../lib/beginnerGlossary'

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  content: React.ReactNode
  placement?: TooltipPlacement
  children: React.ReactElement<Record<string, unknown>>
  className?: string
  /** Enable click/tap sticky toggle, outside-click dismissal, and optional close control. */
  interactive?: boolean
  /** Accessible title shown when `interactive` popup is open. */
  title?: string
}

const PLACEMENT_CLASSES: Record<TooltipPlacement, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
}

interface FloatingCoords {
  top: number
  left: number
}

function computeViewportSafeCoords(
  anchorRect: DOMRect,
  popupRect: DOMRect,
  preferred: TooltipPlacement,
): FloatingCoords | null {
  if (
    typeof window === 'undefined' ||
    (anchorRect.width === 0 && anchorRect.height === 0) ||
    (popupRect.width === 0 && popupRect.height === 0)
  ) {
    return null
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 10
  const gap = 8

  let resolved = preferred
  if (preferred === 'top' && anchorRect.top - popupRect.height - gap < margin) {
    resolved = 'bottom'
  } else if (
    preferred === 'bottom' &&
    anchorRect.bottom + popupRect.height + gap > vh - margin
  ) {
    resolved = 'top'
  } else if (preferred === 'left' && anchorRect.left - popupRect.width - gap < margin) {
    resolved = 'right'
  } else if (preferred === 'right' && anchorRect.right + popupRect.width + gap > vw - margin) {
    resolved = 'left'
  }

  let top = anchorRect.top - popupRect.height - gap
  let left = anchorRect.left + anchorRect.width / 2 - popupRect.width / 2

  if (resolved === 'bottom') {
    top = anchorRect.bottom + gap
  } else if (resolved === 'left') {
    top = anchorRect.top + anchorRect.height / 2 - popupRect.height / 2
    left = anchorRect.left - popupRect.width - gap
  } else if (resolved === 'right') {
    top = anchorRect.top + anchorRect.height / 2 - popupRect.height / 2
    left = anchorRect.right + gap
  }

  left = Math.max(margin, Math.min(left, vw - popupRect.width - margin))
  top = Math.max(margin, Math.min(top, vh - popupRect.height - margin))

  return { top, left }
}

/**
 * Accessible keyboard-, hover-, and tap-triggered tooltip / help popover.
 * Dismisses immediately on Escape key press or outside pointer tap.
 */
export function Tooltip({
  content,
  placement = 'top',
  children,
  className = '',
  interactive = false,
  title,
}: TooltipProps) {
  const [hoverOpen, setHoverOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [floatingCoords, setFloatingCoords] = useState<FloatingCoords | null>(null)
  const tooltipId = useId()
  const wrapperRef = useRef<HTMLSpanElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)

  const open = hoverOpen || pinned

  const closeAll = useCallback(() => {
    setHoverOpen(false)
    setPinned(false)
  }, [])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeAll()
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (
        target &&
        !wrapperRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        closeAll()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, closeAll])

  const updatePosition = useCallback(() => {
    if (!open || !interactive || !wrapperRef.current || !popupRef.current) {
      setFloatingCoords(null)
      return
    }
    const anchorRect = wrapperRef.current.getBoundingClientRect()
    const popupRect = popupRef.current.getBoundingClientRect()
    setFloatingCoords(computeViewportSafeCoords(anchorRect, popupRect, placement))
  }, [open, interactive, placement])

  useLayoutEffect(() => {
    updatePosition()
    if (!open || !interactive) return
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, interactive, updatePosition])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      closeAll()
    }
  }

  const originalOnClick = children.props.onClick as
    | ((e: React.MouseEvent) => void)
    | undefined

  const childProps: Record<string, unknown> = {
    'aria-describedby': open ? tooltipId : undefined,
  }

  if (interactive) {
    childProps['aria-expanded'] = open
    childProps['aria-controls'] = open ? tooltipId : undefined
    childProps.onClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      setPinned((prev) => {
        const next = !prev
        if (!next) setHoverOpen(false)
        return next
      })
      originalOnClick?.(e)
    }
  }

  const popupNode = open && content && (
    <div
      ref={popupRef}
      id={tooltipId}
      role={interactive && pinned ? 'dialog' : 'tooltip'}
      aria-label={title}
      onMouseEnter={interactive ? () => setHoverOpen(true) : undefined}
      onMouseLeave={
        interactive
          ? () => {
              if (!pinned) setHoverOpen(false)
            }
          : undefined
      }
      style={
        floatingCoords
          ? {
              position: 'fixed',
              top: `${floatingCoords.top}px`,
              left: `${floatingCoords.left}px`,
              zIndex: 80,
            }
          : undefined
      }
      className={
        interactive
          ? `${
              floatingCoords
                ? 'fixed z-[80]'
                : `absolute z-50 ${PLACEMENT_CLASSES[placement]}`
            } w-[min(19.5rem,calc(100vw-20px))] rounded-md border border-navy-700 bg-navy-950 p-3 text-xs font-sans leading-relaxed text-white shadow-xl ${className}`.trim()
          : `pointer-events-none absolute z-50 w-max max-w-xs rounded-xs border border-navy-700 bg-navy-950 px-2.5 py-1.5 text-2xs font-sans leading-snug text-white shadow-md ${PLACEMENT_CLASSES[placement]} ${className}`.trim()
      }
    >
      {interactive ? (
        <div className="space-y-1.5">
          {(title || pinned) && (
            <div className="flex items-start justify-between gap-2 border-b border-navy-800 pb-1.5">
              {title ? (
                <div className="text-xs font-semibold leading-snug text-white">
                  {title}
                </div>
              ) : (
                <span />
              )}
              {pinned && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeAll()
                  }}
                  aria-label="Close help explanation"
                  className="shrink-0 rounded-xs px-1 py-0.5 text-xs leading-none text-navy-200 hover:bg-navy-800 hover:text-white focus:outline-none focus:ring-1 focus:ring-sky-300"
                >
                  ×
                </button>
              )}
            </div>
          )}
          <div className="text-[12px] leading-relaxed text-navy-50">{content}</div>
        </div>
      ) : (
        content
      )}
    </div>
  )

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setHoverOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setHoverOpen(false)
      }}
      onFocus={() => setHoverOpen(true)}
      onBlur={(e) => {
        const nextTarget = e.relatedTarget as Node | null
        if (
          !pinned &&
          (!nextTarget ||
            (!wrapperRef.current?.contains(nextTarget) &&
              !popupRef.current?.contains(nextTarget)))
        ) {
          setHoverOpen(false)
        }
      }}
      onKeyDown={handleKeyDown}
    >
      {React.cloneElement(children, childProps)}
      {interactive && typeof document !== 'undefined' && floatingCoords
        ? createPortal(popupNode, document.body)
        : popupNode}
    </span>
  )
}

export interface HelpTooltipProps {
  /** Key from BEGINNER_GLOSSARY for consistent 3-part plain explanations. */
  glossaryKey?: GlossaryKey
  title?: string
  whatItMeans?: string
  whyItMatters?: string
  whatToDo?: string
  /** Custom accessible label for the `?` button. */
  label?: string
  placement?: TooltipPlacement
  /** Use `inverted` on dark navy headers/sidebars; `default` on light paper surfaces. */
  tone?: 'default' | 'inverted'
  className?: string
}

/**
 * Compact 18px circular `?` trigger built on Tooltip for inline plain-language help.
 */
export function HelpTooltip({
  glossaryKey,
  title,
  whatItMeans,
  whyItMatters,
  whatToDo,
  label,
  placement = 'top',
  tone = 'default',
  className = '',
}: HelpTooltipProps) {
  const entry = glossaryKey ? BEGINNER_GLOSSARY[glossaryKey] : undefined
  const resolvedTitle = title ?? entry?.plainTitle ?? 'Plain-Language Help'
  const resolvedMeans = whatItMeans ?? entry?.whatItMeans
  const resolvedMatters = whyItMatters ?? entry?.whyItMatters
  const resolvedDo = whatToDo ?? entry?.whatToDo
  const resolvedAriaLabel = label ?? `Explain ${entry?.term ?? resolvedTitle}`

  const triggerToneClasses =
    tone === 'inverted'
      ? 'border-white/30 bg-white/10 text-navy-100 hover:border-white/60 hover:bg-white/20 hover:text-white focus:ring-sky-300'
      : 'border-rule bg-subtle text-ink-2 hover:border-navy-600 hover:bg-navy-50 hover:text-navy-900 focus:ring-navy-700'

  const contentNode = (
    <div className="space-y-1.5">
      {entry?.term && entry.term !== resolvedTitle && (
        <div className="text-[11px] font-medium text-sky-300">
          Term: {entry.term}
        </div>
      )}
      {resolvedMeans && <p>{resolvedMeans}</p>}
      {resolvedMatters && (
        <p className="text-navy-200">
          <span className="font-semibold text-white">Why it matters: </span>
          {resolvedMatters}
        </p>
      )}
      {resolvedDo && (
        <p className="rounded-xs bg-navy-900/90 px-2 py-1 text-emerald-200">
          <span className="font-semibold text-emerald-100">What to do: </span>
          {resolvedDo}
        </p>
      )}
    </div>
  )

  return (
    <Tooltip
      interactive
      placement={placement}
      title={resolvedTitle}
      content={contentNode}
    >
      <button
        type="button"
        aria-label={resolvedAriaLabel}
        title={resolvedAriaLabel}
        className={`inline-flex min-h-[24px] min-w-[24px] shrink-0 items-center justify-center rounded-full focus:outline-none focus:ring-2 ${className}`.trim()}
      >
        <span
          aria-hidden="true"
          className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[11px] font-bold leading-none transition-colors ${triggerToneClasses}`.trim()}
        >
          ?
        </span>
      </button>
    </Tooltip>
  )
}

