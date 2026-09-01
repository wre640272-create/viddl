import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import os from 'os'
import type { DownloadOptions, DownloadProgress, DownloadTask, VideoInfo, FormatInfo, ProbeResult } from '../../shared/types'

export interface ProbeResultRaw {
  id?: string
  title?: string
  uploader?: string
  duration?: number
  thumbnail?: string
  webpage_url?: string
  view_count?: number
  formats?: RawFormat[]
}

interface RawFormat {
  format_id?: string
  ext?: string
  resolution?: string
  vcodec?: string
  acodec?: string
  filesize?: number
  tbr?: number
  format_note?: string
  height?: number
  fps?: number
}

export class YtDlpManager extends EventEmitter {
  private binaryPath: string
  private tasks = new Map<string, DownloadTask>()
  private processes = new Map<string, ChildProcess>()
  private ffmpegDir: string | null = null

  constructor() {
    super()
    this.binaryPath = this.resolveBinary()
    this.ffmpegDir = this.resolveFfmpegDir()
  }

  /** Directory containing a co-located ffmpeg.exe, or null if none found. */
  private resolveFfmpegDir(): string | null {
    const dirs: string[] = [dirname(this.binaryPath)]
    if (app.isPackaged) {
      dirs.push(join(process.resourcesPath, 'bin'))
    } else {
      dirs.push(join(app.getAppPath(), 'resources', 'bin'))
    }
    for (const d of dirs) {
      const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
      if (existsSync(join(d, exe))) return d
    }
    return null
  }

  hasFfmpeg(): boolean {
    return this.ffmpegDir !== null
  }

  getBinary(): string {
    return this.binaryPath
  }

  isAvailable(): boolean {
    return existsSync(this.binaryPath)
  }

  private resolveBinary(): string {
    // 1. Bundled resource (in packaged app / resources/bin)
    const candidates: string[] = []
    if (app.isPackaged) {
      candidates.push(join(process.resourcesPath, 'bin', 'yt-dlp.exe'))
      candidates.push(join(process.resourcesPath, 'bin', 'yt-dlp'))
    } else {
      const dev = join(app.getAppPath(), 'resources', 'bin')
      candidates.push(join(dev, 'yt-dlp.exe'))
      candidates.push(join(dev, 'yt-dlp'))
    }
    // 2. Local temp bootstrap
    candidates.push(join(os.tmpdir(), 'viddl', 'yt-dlp.exe'))

    for (const c of candidates) {
      if (existsSync(c)) return c
    }
    // 3. System PATH
    return 'yt-dlp'
  }

  /** Ensure the bundled binary is runnable (bootstrap yt-dlp from resources if missing). */
  async ensureBinary(): Promise<string> {
    if (existsSync(this.binaryPath)) return this.binaryPath
    const fallback = await this.tryResolveFromPath()
    if (fallback) return (this.binaryPath = fallback)
    throw new Error(
      'yt-dlp not found. Place yt-dlp.exe in the resources/bin folder or install yt-dlp and add it to PATH.'
    )
  }

  private async tryResolveFromPath(): Promise<string | null> {
    return new Promise((resolve) => {
      const p = spawn('yt-dlp', ['--version'], { windowsHide: true })
      p.on('error', () => resolve(null))
      p.on('close', (code) => {
        resolve(code === 0 ? 'yt-dlp' : null)
      })
    })
  }

  getActiveTasks(): DownloadTask[] {
    return Array.from(this.tasks.values())
  }

  getTask(id: string): DownloadTask | undefined {
    return this.tasks.get(id)
  }

  clearFinished(): void {
    for (const [id, t] of this.tasks) {
      if (t.status === 'done' || t.status === 'error' || t.status === 'cancelled') {
        this.tasks.delete(id)
      }
    }
  }

  removeTask(id: string): void {
    this.tasks.delete(id)
  }

  private run(args: string[], onData?: (line: string) => void): Promise<{ code: number; output: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let out = ''
      let err = ''
      proc.stdout.on('data', (d: Buffer) => {
        const str = d.toString()
        out += str
        for (const line of str.split(/\r?\n/)) {
          if (line.trim()) onData?.(line)
        }
      })
      proc.stderr.on('data', (d: Buffer) => {
        err += d.toString()
      })
      proc.on('error', (e) => reject(e))
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ code: 0, output: out + err })
        } else {
          reject(new Error(`yt-dlp exited with code ${code}:\n${(err || out).slice(-2000)}`))
        }
      })
    })
  }

  async probe(url: string): Promise<ProbeResult | null> {
    const bin = await this.ensureBinary()
    this.binaryPath = bin
    const res = await this.run(
      ['-J', '--no-playlist', '--no-warnings', url],
      (line) => {
        if (/^\s*[Ii]nfo\b|WARNING|probably not a play/.test(line)) return
        this.emit('log', line)
      }
    )
    const json = res.output
    const start = json.indexOf('{')
    if (start === -1) throw new Error('Could not parse media information')
    const data: ProbeResultRaw = JSON.parse(json.slice(start))
    return this.mapProbe(data)
  }

  private mapProbe(data: ProbeResultRaw): ProbeResult | null {
    if (!data) return null
    const formats: FormatInfo[] = (data.formats || [])
      .map((f) => this.mapFormat(f))
      .filter((f): f is FormatInfo => f !== null)

    const videos = formats.filter((f) => f.isVideo)
    const audios = formats.filter((f) => f.isAudio)

    const pickVideo = () =>
      [...videos]
        .sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0))[0]
    const pickAudio = () => [...audios].sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0]

    const info: VideoInfo = {
      id: data.id || '',
      title: data.title || 'Unknown title',
      uploader: data.uploader,
      duration: data.duration,
      thumbnail: data.thumbnail?.replace(/^https?:/, 'https:'),
      webpageUrl: data.webpage_url,
      viewCount: data.view_count,
      formats,
      bestVideo: pickVideo(),
      bestAudio: pickAudio()
    }
    return { info, suggested: { video: pickVideo(), audio: pickAudio() } }
  }

  private mapFormat(f: RawFormat): FormatInfo | null {
    if (!f.format_id) return null
    const hasVideo = !!f.vcodec && f.vcodec !== 'none'
    const hasAudio = !!f.acodec && f.acodec !== 'none'
    const resolution = f.resolution || (f.height ? `${f.height}p` : '')
    return {
      formatId: f.format_id,
      ext: f.ext || '?',
      resolution,
      fps: f.fps,
      vcodec: f.vcodec || 'none',
      acodec: f.acodec || 'none',
      filesize: f.filesize,
      tbr: f.tbr,
      note: f.format_note,
      height: f.height,
      isVideo: hasVideo,
      isAudio: hasAudio && !hasVideo
    }
  }

  async startDownload(url: string, options: DownloadOptions): Promise<string> {
    await this.ensureBinary()
    const id = `dl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const task: DownloadTask = {
      id,
      url,
      title: options.formatLabel || 'Preparing...',
      status: 'queued',
      progress: 0,
      createdAt: Date.now()
    }
    this.tasks.set(id, task)
    this.emit('task', task)

    const outputDir = options.outputDir
    if (outputDir && !existsSync(outputDir)) {
      try {
        mkdirSync(outputDir, { recursive: true })
      } catch {}
    }

    const args = this.buildDownloadArgs(url, options, outputDir)
    const proc = spawn(this.binaryPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    this.processes.set(id, proc)

    proc.stdout.on('data', (d: Buffer) => this.parseProgress(id, d.toString()))
    proc.stderr.on('data', (d: Buffer) => this.parseProgress(id, d.toString()))

    proc.on('error', (e) => {
      this.finishError(id, e.message)
    })

    proc.on('close', (code) => {
      this.processes.delete(id)
      const t = this.tasks.get(id)
      if (!t || t.status === 'cancelled') return
      if (code === 0) {
        t.status = 'done'
        t.progress = 100
        this.emit('task', t)
      } else {
        // yt-dlp may print "Deleting original file" errors; treat non-zero as error only if not already done
        if (t.status !== 'done') {
          this.finishError(id, this.lastError || 'Download failed')
        }
      }
    })

    this.emit('task', task)
    return id
  }

  private lastError = ''

  private buildDownloadArgs(url: string, options: DownloadOptions, outputDir?: string): string[] {
    const args: string[] = [
      '--no-playlist',
      '--no-warnings',
      '--newline',
      '--no-mtime'
    ]
    if (this.ffmpegDir) {
      args.push('--ffmpeg-location', this.ffmpegDir)
    }
    args.push('--progress-template', '%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s')
    args.push('--print', 'after_move:filepath:%(filepath)s')
    args.push('--print', 'before_dl:title:%(title)s')

    if (options.audioOnly) {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0')
    } else if (options.formatId && options.formatId !== 'auto') {
      args.push('-f', options.formatId)
    } else {
      // best video + best audio merged with proper codecs
      args.push('-f', 'bv*+ba/b')
    }

    if (outputDir) {
      args.push('-o', join(outputDir, '%(title)s.%(ext)s'))
    } else {
      args.push('-o', '%(title)s.%(ext)s')
    }
    args.push(url)
    return args
  }

  private parseProgress(id: string, chunk: string): void {
    const t = this.tasks.get(id)
    if (!t) return
    const lines = chunk.split(/\r?\n/)
    for (const line of lines) {
      if (!line.trim()) continue
      this.processLine(id, line)
    }
  }

  private processLine(id: string, chunk: string): void {
    const t = this.tasks.get(id)
    if (!t) return

    const templateMatch = chunk.match(/([\d.]+)%\|([^|]*)\|([^|]*)/)
    if (templateMatch) {
      const percent = parseFloat(templateMatch[1])
      const speed = templateMatch[2]
      const eta = templateMatch[3]
      if (!isNaN(percent)) t.progress = Math.round(percent)
      t.speed = speed && speed !== 'NA' ? speed : t.speed
      t.eta = eta && eta !== 'NA' ? eta : t.eta
      t.status = 'downloading'
      if (percent !== lastPercentCache.get(id)) {
        lastPercentCache.set(id, percent)
        const progress: DownloadProgress = {
          id,
          percent: t.progress,
          speed: t.speed,
          eta: t.eta
        }
        this.emit('progress', progress)
        this.emit('task', { ...t })
      }
      return
    }

    const titleMatch = chunk.match(/^title:(.*)\r?$/)
    if (titleMatch) {
      t.title = titleMatch[1].trim()
      this.emit('task', { ...t })
      return
    }

    const fileMatch = chunk.match(/^(?:after_move:)?filepath:(.*)\r?$/)
    if (fileMatch) {
      t.filePath = fileMatch[1].trim()
      const ext = (t.filePath.match(/\.([a-zA-Z0-9]{1,5})$/) || [])[1]
      t.ext = ext || t.ext
      this.emit('task', { ...t })
      return
    }

    // Merge progress lines like "[Merger] Merging formats" or download details
    if (/Merging formats|ExtractAudio|Deleting original|has already been downloaded/.test(chunk)) {
      if (t.status === 'downloading' || t.status === 'queued') t.status = 'processing'
      this.emit('task', { ...t })
    }

    // Track the last significant progress for % display on "downloading" state lines
    const pctLine = chunk.match(/^\[download\]\s+([\d.]+)%/)
    if (pctLine && !isNaN(parseFloat(pctLine[1]))) {
      const p = Math.round(parseFloat(pctLine[1]))
      if (p > t.progress) {
        t.progress = p
        this.emit('task', { ...t })
      }
    }

    if (/error|failed|unable|403|forbidden|not available/i.test(chunk)) {
      this.lastError = chunk.trim()
    }
  }

  private finishError(id: string, message: string): void {
    const t = this.tasks.get(id)
    if (!t) return
    t.status = 'error'
    t.error = message
    this.emit('task', { ...t })
  }

  cancelDownload(id: string): void {
    const proc = this.processes.get(id)
    const t = this.tasks.get(id)
    if (proc) {
      try {
        proc.kill('SIGKILL')
      } catch {}
    }
    if (t) {
      t.status = 'cancelled'
      this.emit('task', { ...t })
    }
    this.processes.delete(id)
  }

  async getVersion(): Promise<string | null> {
    try {
      const bin = await this.ensureBinary()
      this.binaryPath = bin
    } catch {
      return null
    }
    try {
      const res = await this.run(['--version'])
      return res.output.trim()
    } catch {
      return null
    }
  }
}

const lastPercentCache = new Map<string, number>()
export const downloader = new YtDlpManager()
