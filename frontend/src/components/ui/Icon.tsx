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

import type { LucideIcon, LucideProps } from 'lucide-react'

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const ICON_SIZE_PX: Record<IconSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
}

export interface IconProps extends Omit<LucideProps, 'size'> {
  /** Lucide icon component to render */
  icon: LucideIcon
  /** Standardized icon size token */
  size?: IconSize
  /** Optional accessible label; if omitted, icon is treated as decorative (aria-hidden="true") */
  label?: string
}

/**
 * Standardized icon wrapper enforcing consistent stroke weight (1.75px),
 * crisp sizing, and WAI-ARIA decorative vs. semantic attributes.
 */
export function Icon({
  icon: LucideComponent,
  size = 'md',
  strokeWidth = 1.75,
  label,
  className = '',
  ...rest
}: IconProps) {
  const pixelSize = ICON_SIZE_PX[size]
  return (
    <LucideComponent
      size={pixelSize}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      className={` shrink-0 select-none ${className}`.trim()}
      {...rest}
    />
  )
}
