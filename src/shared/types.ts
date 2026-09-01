export interface FormatInfo {
  formatId: string
  ext: string
  resolution: string
  fps?: number
  vcodec: string
  acodec: string
  filesize?: number
  tbr?: number
  note?: string
  height?: number
  isVideo: boolean
  isAudio: boolean
}

export interface VideoInfo {
  id: string
  title: string
  uploader?: string
  duration?: number
  thumbnail?: string
  webpageUrl?: string
  viewCount?: number
  formats: FormatInfo[]
  bestVideo?: FormatInfo
  bestAudio?: FormatInfo
}

export interface DownloadOptions {
  formatId?: string
  audioOnly?: boolean
  quality?: string
  outputDir?: string
  formatLabel?: string
}

export interface DownloadTask {
  id: string
  url: string
  title: string
  status: 'queued' | 'downloading' | 'processing' | 'done' | 'error' | 'cancelled'
  progress: number
  speed?: string
  eta?: string
  downloadedBytes?: number
  totalBytes?: number
  filePath?: string
  error?: string
  ext?: string
  formatLabel?: string
  createdAt: number
}

export interface DownloadProgress {
  id: string
  percent: number
  speed?: string
  eta?: string
  downloaded?: number
  total?: number
  filename?: string
}

export interface ProbeResult {
  info: VideoInfo
  suggested?: { video: FormatInfo; audio: FormatInfo }
}
