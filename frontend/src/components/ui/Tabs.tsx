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

import React, { createContext, useContext, useId, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'

export type TabsVariant = 'underline' | 'segmented'

interface TabsContextValue {
  value: string
  onValueChange: (next: string) => void
  baseId: string
  variant: TabsVariant
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) {
    throw new Error('Tabs subcomponents must be used within <Tabs>')
  }
  return ctx
}

export interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  variant?: TabsVariant
  className?: string
  children: React.ReactNode
}

export function Tabs({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  variant = 'underline',
  className = '',
  children,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
  const baseId = useId()
  const activeValue = controlledValue !== undefined ? controlledValue : uncontrolledValue

  const handleChange = (next: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(next)
    }
    onValueChange?.(next)
  }

  return (
    <TabsContext.Provider
      value={{ value: activeValue, onValueChange: handleChange, baseId, variant }}
    >
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  ariaLabel?: string
}

export function TabsList({
  ariaLabel,
  className = '',
  children,
  ...rest
}: TabsListProps) {
  const { variant } = useTabsContext()
  const containerClass =
    variant === 'segmented'
      ? 'inline-flex items-center gap-1 p-1 bg-subtle border border-rule-subtle rounded-sm'
      : 'flex items-center gap-1 border-b border-rule-subtle bg-subtle/40 px-3 overflow-x-auto'

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const triggers = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')
    )
    const currentIndex = triggers.indexOf(document.activeElement as HTMLButtonElement)
    if (currentIndex === -1 || triggers.length === 0) return

    e.preventDefault()
    const nextIndex =
      e.key === 'ArrowRight'
        ? (currentIndex + 1) % triggers.length
        : (currentIndex - 1 + triggers.length) % triggers.length
    const nextTab = triggers[nextIndex]
    nextTab?.focus()
    nextTab?.click()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`${containerClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  )
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  icon?: LucideIcon
  badge?: React.ReactNode
}

export function TabsTrigger({
  value,
  icon,
  badge,
  disabled,
  className = '',
  children,
  ...rest
}: TabsTriggerProps) {
  const { value: activeValue, onValueChange, baseId, variant } = useTabsContext()
  const isSelected = activeValue === value
  const tabId = `${baseId}-tab-${value}`
  const panelId = `${baseId}-panel-${value}`

  const variantClasses =
    variant === 'segmented'
      ? isSelected
        ? 'bg-sheet text-ink font-semibold shadow-xs border border-rule'
        : 'text-ink-2 hover:text-ink border border-transparent'
      : isSelected
        ? 'border-b-2 border-accent text-accent font-semibold bg-sheet/80 -mb-px'
        : 'border-b-2 border-transparent text-ink-2 hover:text-ink hover:border-rule-strong -mb-px'

  return (
    <button
      id={tabId}
      type="button"
      role="tab"
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs select-none whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 disabled:pointer-events-none ${
        variant === 'segmented' ? 'rounded-xs py-1.5 px-3' : 'rounded-t-xs'
      } ${variantClasses} ${className}`.trim()}
      {...rest}
    >
      {icon && <Icon icon={icon} size="sm" />}
      <span>{children}</span>
      {badge}
    </button>
  )
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export function TabsContent({
  value,
  className = '',
  children,
  ...rest
}: TabsContentProps) {
  const { value: activeValue, baseId } = useTabsContext()
  const isSelected = activeValue === value
  const tabId = `${baseId}-tab-${value}`
  const panelId = `${baseId}-panel-${value}`

  if (!isSelected) return null

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      tabIndex={0}
      className={`focus:outline-none ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  )
}

