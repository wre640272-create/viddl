import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type {
  DownloadOptions,
  DownloadProgress,
  DownloadTask,
  ProbeResult
} from '../shared/types'

const api = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  getDownloaderVersion: (): Promise<string | null> =>
    ipcRenderer.invoke('downloader:version'),
  isDownloaderAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke('downloader:available'),
  hasFfmpeg: (): Promise<boolean> => ipcRenderer.invoke('downloader:ffmpeg'),
  probe: (url: string): Promise<ProbeResult | null> =>
    ipcRenderer.invoke('downloader:probe', url),
  startDownload: (url: string, options: DownloadOptions): Promise<string> =>
    ipcRenderer.invoke('downloader:start', url, options),
  cancelDownload: (id: string): Promise<void> =>
    ipcRenderer.invoke('downloader:cancel', id),
  getTasks: (): Promise<DownloadTask[]> => ipcRenderer.invoke('downloader:tasks'),
  clearFinished: (): Promise<DownloadTask[]> =>
    ipcRenderer.invoke('downloader:clearFinished'),
  removeTask: (id: string): Promise<void> =>
    ipcRenderer.invoke('downloader:removeTask', id),
  selectDirectory: (): Promise<string> => ipcRenderer.invoke('dialog:selectDir'),
  getDefaultDirectory: (): Promise<string> =>
    ipcRenderer.invoke('dialog:getDefaultDir'),
  showInFolder: (path: string): Promise<void> =>
    ipcRenderer.invoke('shell:showInFolder', path),
  openPath: (path: string): Promise<void> =>
    ipcRenderer.invoke('shell:openPath', path),
  onProgress: (cb: (p: DownloadProgress) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, p: DownloadProgress) => cb(p)
    ipcRenderer.on('downloader:progress', listener)
    return () => ipcRenderer.removeListener('downloader:progress', listener)
  },
  onTask: (cb: (t: DownloadTask) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, t: DownloadTask) => cb(t)
    ipcRenderer.on('downloader:task', listener)
    return () => ipcRenderer.removeListener('downloader:task', listener)
  },
  onLog: (cb: (line: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, line: string) => cb(line)
    ipcRenderer.on('downloader:log', listener)
    return () => ipcRenderer.removeListener('downloader:log', listener)
  }
}

export type DownloadApi = typeof api

contextBridge.exposeInMainWorld('api', api)
