import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { downloader } from './downloader/ytdlp'
import type { DownloadOptions } from '../shared/types'

let mainWindow: BrowserWindow | null = null

let defaultDownloadDir = join(app.getPath('downloads'), 'VidDL')

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    title: 'VidDL',
    backgroundColor: '#0a0f1e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function registerIpc(): void {
  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('downloader:version', async () => {
    return downloader.getVersion()
  })

  ipcMain.handle('downloader:available', () => downloader.isAvailable())

  ipcMain.handle('downloader:ffmpeg', () => downloader.hasFfmpeg())

  ipcMain.handle('downloader:probe', async (_e, url: string) => {
    return downloader.probe(url)
  })

  ipcMain.handle('downloader:start', async (_e, url: string, options: DownloadOptions) => {
    const opts: DownloadOptions = { ...options }
    if (!opts.outputDir) opts.outputDir = defaultDownloadDir
    return downloader.startDownload(url, opts)
  })

  ipcMain.handle('downloader:cancel', (_e, id: string) => {
    downloader.cancelDownload(id)
  })

  ipcMain.handle('downloader:tasks', () => downloader.getActiveTasks())

  ipcMain.handle('downloader:clearFinished', () => {
    downloader.clearFinished()
    return downloader.getActiveTasks()
  })

  ipcMain.handle('downloader:removeTask', (_e, id: string) => {
    downloader.removeTask(id)
  })

  ipcMain.handle('dialog:selectDir', async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose download folder'
    })
    if (!res.canceled && res.filePaths.length > 0) {
      defaultDownloadDir = res.filePaths[0]
      return res.filePaths[0]
    }
    return defaultDownloadDir
  })

  ipcMain.handle('dialog:getDefaultDir', () => defaultDownloadDir)

  ipcMain.handle('shell:showInFolder', (_e, path: string) => {
    if (path) shell.showItemInFolder(path)
  })

  ipcMain.handle('shell:openPath', (_e, path: string) => {
    if (path) shell.openPath(path)
  })

  // Stream events to renderer
  downloader.on('progress', (p) => {
    mainWindow?.webContents.send('downloader:progress', p)
  })
  downloader.on('task', (t) => {
    mainWindow?.webContents.send('downloader:task', t)
  })
  downloader.on('log', (line) => {
    mainWindow?.webContents.send('downloader:log', line)
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
