import type { DownloadApi } from './index'

declare global {
  interface Window {
    api: DownloadApi
  }
}

export {}
