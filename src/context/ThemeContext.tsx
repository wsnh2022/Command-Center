import { createContext, useContext, ReactNode } from 'react'
import { useSettings } from './SettingsContext'
import type { Theme } from '../types'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
})

// ThemeProvider must be nested inside SettingsProvider
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings()
  const theme: Theme = settings?.theme ?? 'dark'

  function toggleTheme(): void {
    updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
