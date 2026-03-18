import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from 'react'
import { Search } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useSearch } from '../../hooks/useSearch'
import SearchResults from './SearchResults'
import { ipc } from '../../utils/ipc'
import type { NavigateFn } from '../../types/navigation'
import type { SearchResult } from '../../hooks/useSearch'

interface TopBarProps {
  navigate: NavigateFn
}

// Extracted so React actually remounts on key change → re-fires slide + icon animation
// Track: 44×22px  Thumb: 18×18px  Travel: 22px (44 - 18 - 2×2px padding)
function ThemeThumb({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <div
      className={theme === 'light' ? 'theme-thumb-right' : 'theme-thumb-left'}
      style={{
        position: 'absolute',
        left: '2px',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: theme === 'dark'
          ? 'radial-gradient(circle at 35% 35%, #2a2060, #1a1040)'
          : 'radial-gradient(circle at 35% 35%, #fff9c4, #ffe066)',
        boxShadow: theme === 'dark'
          ? '0 1px 4px rgba(0,0,0,0.7)'
          : '0 1px 4px rgba(255,180,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {theme === 'dark' ? (
        <svg
          className="theme-moon-enter"
          width="9" height="9" viewBox="0 0 24 24"
          fill="#c8b6ff" stroke="none"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        </svg>
      ) : (
        <span className="theme-sun-enter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="theme-ray-spin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2"  x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2"  y1="12" x2="5"  y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
              <line x1="4.22"  y1="4.22"  x2="6.34"  y2="6.34" />
              <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
              <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66" />
              <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22" />
            </svg>
          </span>
        </span>
      )}
    </div>
  )
}

// Window control button — muted at rest, colored on hover
// Uses React state so the color transition is reliable across all SVG child elements
function WinBtn({ onClick, label, hoverColor, children }: {
  onClick: () => void
  label: string
  hoverColor: string
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center w-5 h-5 rounded-sm transition-colors duration-150"
      style={{ color: hovered ? hoverColor : 'var(--color-text-muted, #666)' }}
    >
      {children}
    </button>
  )
}

// Static style objects — extracted to avoid object allocation on every render
const S_DRAG:    CSSProperties = { height: '48px', WebkitAppRegion: 'drag'    }
const S_NO_DRAG: CSSProperties = { WebkitAppRegion: 'no-drag' }

export default function TopBar({ navigate }: TopBarProps) {
  const { theme, toggleTheme } = useTheme()

  const [query,     setQuery]     = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const { results } = useSearch(query)

  // Reset activeIdx when results shrink and current index is out of bounds.
  // useEffect (not during-render setState) to avoid synchronous mid-render re-renders.
  useEffect(() => {
    setActiveIdx(prev => (prev >= results.length ? -1 : prev))
  }, [results])

  // Ctrl+S focuses the search bar from anywhere in the window
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function closeSearch() {
    setQuery('')
    setActiveIdx(-1)
  }

  async function handleSelect(result: SearchResult) {
    closeSearch()
    inputRef.current?.blur()
    await ipc.items.launch(result.itemId).catch(console.error)
    navigate({ type: 'group', groupId: result.groupId })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (results.length) setActiveIdx(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (results.length) setActiveIdx(i => Math.max(i - 1, -1))
        break
      case 'Enter':
        if (activeIdx >= 0 && activeIdx < results.length) {
          e.preventDefault()
          handleSelect(results[activeIdx])
        }
        break
      case 'Escape':
        e.preventDefault()
        closeSearch()
        inputRef.current?.blur()
        break
    }
  }

  const showDropdown = query.trim().length > 0

  return (
    <header
      className="flex items-center gap-3 px-4 bg-surface-0 shrink-0 border-b border-surface-2"
      style={S_DRAG}
    >
      {/* Search bar — full width, results dropdown below */}
      <div className="relative flex-1" style={S_NO_DRAG}>
        <div className="flex items-center gap-2 bg-surface-3 rounded-input px-3 h-8 text-sm border border-surface-4
                        hover:border-accent transition-base duration-base
                        focus-within:border-accent focus-within:shadow-[0_0_0_2px_var(--accent-soft)]">
          <Search size={14} className="shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(-1) }}
            onKeyDown={handleKeyDown}
            placeholder="Search everything..."
            className="bg-transparent outline-none flex-1 text-text-primary placeholder:text-text-muted text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          {/* Clear button — visible when there's a query */}
          {query && (
            <button
              onClick={closeSearch}
              className="text-text-muted hover:text-text-primary transition-base duration-base text-[12px] leading-none px-0.5"
              tabIndex={-1}
            >✕</button>
          )}
        </div>

        {/* Results dropdown — conditionally rendered */}
        {showDropdown && (
          <SearchResults
            results={results}
            query={query}
            activeIdx={activeIdx}
            onSelect={handleSelect}
          />
        )}
      </div>

      {/* Theme toggle — animated pill */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        aria-label="Toggle theme"
        style={S_NO_DRAG}
        className="shrink-0 relative focus-visible:outline-none"
      >
        {/* Track — 44×22px */}
        <div
          className="relative flex items-center rounded-full overflow-hidden transition-all duration-500"
          style={{
            width: '44px',
            height: '22px',
            background: theme === 'dark'
              ? 'linear-gradient(135deg, #0f0c29 0%, #1a1040 50%, #24243e 100%)'
              : 'linear-gradient(135deg, #74b9ff 0%, #a29bfe 50%, #fd79a8 100%)',
            boxShadow: theme === 'dark'
              ? 'inset 0 1px 3px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,111,247,0.35)'
              : 'inset 0 1px 3px rgba(0,0,0,0.15), 0 0 0 1px rgba(253,121,168,0.4)',
          }}
        >
          {/* Dark mode decorations — stars */}
          {theme === 'dark' && (
            <>
              <span className="theme-star-1 absolute" style={{ top: '3px',  left: '6px',  width: '1.5px', height: '1.5px', borderRadius: '50%', background: '#fff' }} />
              <span className="theme-star-2 absolute" style={{ top: '12px', left: '10px', width: '1.5px', height: '1.5px', borderRadius: '50%', background: '#fff' }} />
              <span className="theme-star-3 absolute" style={{ top: '6px',  left: '14px', width: '1px',   height: '1px',   borderRadius: '50%', background: '#c8b6ff' }} />
            </>
          )}
          {/* Light mode decorations — tiny cloud */}
          {theme === 'light' && (
            <div className="absolute" style={{ top: '5px', right: '6px', opacity: 0.5 }}>
              <div style={{ width: '9px', height: '3px', borderRadius: '9999px', background: '#fff', position: 'relative' }}>
                <div style={{ position: 'absolute', width: '5px', height: '5px', borderRadius: '50%', background: '#fff', top: '-2px', left: '1px' }} />
                <div style={{ position: 'absolute', width: '4px', height: '4px', borderRadius: '50%', background: '#fff', top: '-1px', left: '4px' }} />
              </div>
            </div>
          )}

          {/* Sliding thumb — key={theme} remounts ThemeThumb → re-fires CSS animations */}
          <ThemeThumb key={theme} theme={theme} />
        </div>
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-surface-4 shrink-0" />

      {/* Window controls — PS button style, no circles, order: minimize → maximize → close */}
      <div
        className="flex items-center gap-3 shrink-0"
        style={S_NO_DRAG}
      >
        {/* Minimize — plain at rest, yellow on hover */}
        <WinBtn onClick={() => ipc.window.minimize()} label="Minimize" hoverColor="#febc2e">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="5.5" width="10" height="2" rx="1" fill="currentColor" />
          </svg>
        </WinBtn>
        {/* Maximize — plain at rest, green on hover */}
        <WinBtn onClick={() => ipc.window.maximize()} label="Maximize" hoverColor="#28c840">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1" width="10" height="10" rx="1.5" strokeWidth="2" stroke="currentColor" />
          </svg>
        </WinBtn>
        {/* Close — plain at rest, red on hover */}
        <WinBtn onClick={() => ipc.window.close()} label="Close" hoverColor="#ff5f57">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
            <line x1="10.5" y1="1.5" x2="1.5" y2="10.5" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
          </svg>
        </WinBtn>
      </div>
    </header>
  )
}
