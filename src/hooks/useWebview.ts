import { useState, useEffect, useRef, useCallback } from 'react'
import { ipc } from '../utils/ipc'

const DEFAULT_WIDTH  = 480   // matches PANEL_DEFAULT_W in webview.ipc.ts
const DEFAULT_HEIGHT = 320   // matches PANEL_DEFAULT_H in webview.ipc.ts

export interface WebviewControls {
  isOpen:      boolean
  currentUrl:  string
  panelWidth:  number
  panelHeight: number
  position:    'right' | 'bottom'
  open:        (url: string) => void
  close:       () => void
  back:        () => void
  forward:     () => void
  reload:      () => void
  eject:       () => void
  navigate:    (url: string) => void
  resize:      (size: number) => void
}

export function useWebview(): WebviewControls {
  const [isOpen,      setIsOpen]      = useState(false)
  const [currentUrl,  setCurrentUrl]  = useState('')
  const [panelWidth,  setPanelWidth]  = useState(DEFAULT_WIDTH)
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT)
  const [position,    setPosition]    = useState<'right' | 'bottom'>('right')

  // Stable refs so event callbacks registered once don't become stale
  const setOpenRef     = useRef(setIsOpen)
  const setUrlRef      = useRef(setCurrentUrl)
  const setPositionRef = useRef(setPosition)

  useEffect(() => {
    const onOpened = (data: unknown) => {
      setOpenRef.current(true)
      const pos = (data as { position?: 'right' | 'bottom' })?.position ?? 'right'
      setPositionRef.current(pos)
    }
    const onClosed = () => { setOpenRef.current(false); setUrlRef.current('') }
    const onUrlChanged = (data: unknown) => {
      const url = (data as { url: string }).url ?? ''
      setUrlRef.current(url)
    }

    ipc.on('webview:opened',     onOpened)
    ipc.on('webview:closed',     onClosed)
    ipc.on('webview:urlChanged', onUrlChanged)

    return () => {
      ipc.off('webview:opened',     onOpened)
      ipc.off('webview:closed',     onClosed)
      ipc.off('webview:urlChanged', onUrlChanged)
    }
  }, [])  // register once — setters are stable

  const open     = useCallback((url: string) => { ipc.webview.open(url).catch(() => {}) }, [])
  const close    = useCallback(() => { ipc.webview.close().catch(() => {}) }, [])
  const back     = useCallback(() => { ipc.webview.back().catch(() => {}) }, [])
  const forward  = useCallback(() => { ipc.webview.forward().catch(() => {}) }, [])
  const reload   = useCallback(() => { ipc.webview.reload().catch(() => {}) }, [])
  const eject    = useCallback(() => { ipc.webview.eject().catch(() => {}) }, [])
  const navigate = useCallback((url: string) => { ipc.webview.navigate(url).catch(() => {}) }, [])

  const resize = useCallback((size: number) => {
    // size = width in right mode, height in bottom mode
    // We don't know position here, so update both and let main process ignore the wrong one
    setPanelWidth(size)
    setPanelHeight(size)
    ipc.webview.resize(size).catch(() => {})
  }, [])

  return { isOpen, currentUrl, panelWidth, panelHeight, position, open, close, back, forward, reload, eject, navigate, resize }
}
