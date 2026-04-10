/**
 * lucide-registry.ts
 * Dynamic icon loader for all Lucide icons in Command-Center.
 *
 * WHY THIS EXISTS:
 * Static `import { X } from 'lucide-react'` still causes Vite to pre-bundle
 * the full lucide-react barrel (1.08MB, 1400+ icons) on every cold start.
 * Using dynamicIconImports (shipped with lucide-react) loads individual icon
 * files on demand - Vite code-splits them instead of pre-bundling.
 *
 * HOW IT WORKS:
 * - DB stores icon names as PascalCase strings (e.g. 'GitBranch', 'Globe')
 * - dynamicIconImports keys are kebab-case (e.g. 'git-branch', 'globe')
 * - At module load we build an exact PascalCase → kebab-case lookup table
 *   derived directly from dynamicIconImports keys - no regex conversion.
 *   This avoids edge cases like 'ArrowDown01' → 'arrow-down-0-1' (not '01')
 *   or 'Grid2x2' → 'grid-2x2' (not 'grid-2x-2') which broke 8 icons.
 * - Results are cached in a module-level Map - repeat calls are instant.
 *
 * RULE: Never import from the lucide-react barrel for dynamic icon rendering.
 * Static named imports (e.g. in TopBar, WebviewPanel) are fine - those are
 * fixed UI icons that Vite tree-shakes correctly at build time.
 */

import dynamicIconImports from 'lucide-react/dynamicIconImports'
import type { LucideIcon } from 'lucide-react'

// Module-level icon cache - avoids re-importing the same icon file more than once
const cache = new Map<string, LucideIcon>()

// Build exact PascalCase → kebab lookup from the real keys in dynamicIconImports.
// This is the ONLY safe way to do this - regex conversion has edge cases that
// silently break icons (confirmed: 8 icons affected in lucide-react v0.378.0).
function kebabToPascal(kebab: string): string {
  return kebab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

const PASCAL_TO_KEBAB = new Map<string, string>(
  Object.keys(dynamicIconImports).map(kebab => [kebabToPascal(kebab), kebab])
)

/**
 * Load a Lucide icon component by its PascalCase name.
 * Returns null if the name is not found in dynamicIconImports.
 * Results are cached - subsequent calls for the same name are instant.
 */
export async function loadLucideIcon(name: string): Promise<LucideIcon | null> {
  if (!name) return null

  // Cache hit - return immediately
  if (cache.has(name)) return cache.get(name)!

  // Exact lookup - no regex, no edge cases
  const kebab = PASCAL_TO_KEBAB.get(name)
  if (!kebab) return null   // name not in lucide-react at this version

  const importer = dynamicIconImports[kebab as keyof typeof dynamicIconImports]
  if (!importer) return null

  try {
    const mod = await importer()
    const icon = (mod as unknown as { default: LucideIcon }).default
    cache.set(name, icon)       // cache under original PascalCase key
    return icon
  } catch {
    return null                  // import failed (e.g. network issue in dev)
  }
}
