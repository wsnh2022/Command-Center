import { ipcMain, shell, clipboard, dialog, BrowserWindow, app } from 'electron'
import { sanitizeUrl, sanitizePath } from '../utils/sanitize'

export function registerSystemHandlers(): void {

  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('system:openExternal', async (_e, input) => {
    const url = sanitizeUrl(input?.url)
    if (!url) throw new Error('Invalid or unsafe URL')
    await shell.openExternal(url)
  })

  ipcMain.handle('system:openPath', async (_e, input) => {
    const path = sanitizePath(input?.path)
    if (!path) throw new Error('Invalid path')
    const err = await shell.openPath(path)
    if (err) throw new Error(err)
  })

  ipcMain.handle('system:revealInExplorer', (_e, input) => {
    const path = sanitizePath(input?.path)
    if (!path) throw new Error('Invalid path')
    shell.showItemInFolder(path)
  })

  ipcMain.handle('system:copyToClipboard', (_e, input) => {
    if (typeof input?.text !== 'string') throw new Error('Invalid text')
    clipboard.writeText(input.text)
  })

  ipcMain.handle('system:showOpenDialog', async (event, input) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const properties: Electron.OpenDialogOptions['properties'] = []

    if (input?.type === 'folder') {
      properties.push('openDirectory')
    } else {
      properties.push('openFile')
    }

    const result = await dialog.showOpenDialog(win!, {
      title:       input?.title ?? 'Select',
      properties,
      filters:     input?.filters ?? [],
      defaultPath: input?.defaultPath ?? undefined,
    })

    return result.canceled ? null : result.filePaths[0] ?? null
  })

  ipcMain.handle('system:getUserDataPath', () => {
    return app.getPath('userData')
  })

  ipcMain.handle('system:showSaveDialog', async (event, input) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showSaveDialog(win!, {
      title:            input?.title ?? 'Save File',
      defaultPath:      input?.defaultPath ?? undefined,
      filters:          input?.filters ?? [],
    })
    return result.canceled ? null : result.filePath ?? null
  })
}
