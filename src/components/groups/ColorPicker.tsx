import { useState } from 'react'

// 12 preset accent colors matching UI_DESIGN_SPEC palette
const PRESET_COLORS = [
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
]

interface ColorPickerProps {
  value:    string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [customHex, setCustomHex] = useState('')
  const [hexError, setHexError]   = useState(false)

  function applyCustomHex(hex: string) {
    const clean = hex.startsWith('#') ? hex : `#${hex}`
    const valid = /^#[0-9a-fA-F]{6}$/.test(clean)
    setHexError(!valid)
    if (valid) onChange(clean)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-6 gap-1.5">
        {PRESET_COLORS.map(color => (
          <button
            key={color}
            title={color}
            onClick={() => { onChange(color); setCustomHex('') }}
            className="w-7 h-7 rounded-btn border-2 transition-base duration-base"
            style={{
              backgroundColor:  color,
              borderColor:      value === color ? '#fff' : 'transparent',
              boxShadow:        value === color ? `0 0 0 1px ${color}` : 'none',
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-btn shrink-0 border border-surface-4"
          style={{ backgroundColor: value }}
        />
        <input
          type="text"
          value={customHex}
          onChange={e => { setCustomHex(e.target.value); setHexError(false) }}
          onBlur={e => applyCustomHex(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyCustomHex(customHex) }}
          placeholder="#3b82f6"
          maxLength={7}
          className={[
            'flex-1 h-7 px-2 text-xs font-mono bg-surface-3 rounded-input border',
            'text-text-primary placeholder:text-text-muted outline-none',
            'focus:border-accent transition-base duration-base',
            hexError ? 'border-danger' : 'border-surface-4',
          ].join(' ')}
        />
      </div>
    </div>
  )
}
