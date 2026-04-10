/**
 * iconBg.ts
 * Utility to resolve the Tailwind background class for an <img> icon.
 *
 * iconBg values:
 *   'white'       → bg-white
 *   'black'       → bg-[#111111]  (near-black, looks intentional on all surfaces)
 *   'transparent' → no class (icon rendered directly on the surface)
 *   ''            → transparent (default for all sources)
 *
 * Used by: ItemRow, HomePage (ItemIcon), IconPicker (PreviewBox), ItemFormPanel (preview).
 * Single source of truth - change here, all 4 render sites update automatically.
 */
import type { IconSource } from '../types'

export function resolveIconBgClass(iconBg: string, _iconSource: IconSource): string {
  if (iconBg === 'white')       return 'bg-white'
  if (iconBg === 'black')       return 'bg-[#111111]'
  if (iconBg === 'transparent') return ''
  return '' // '' = default - transparent for all sources
}
