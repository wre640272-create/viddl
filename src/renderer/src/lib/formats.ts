import type { FormatInfo } from '@shared/types'

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[i]}`
}

export function formatDuration(sec?: number): string {
  if (!sec) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function formatCount(n?: number): string {
  if (!n) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

export function formatLabel(f: FormatInfo): string {
  const parts: string[] = []
  if (f.resolution) parts.push(f.resolution)
  if (f.fps) parts.push(`${f.fps}fps`)
  if (f.tbr) parts.push(`${Math.round(f.tbr)}kbps`)
  const type = f.isVideo ? (f.isAudio || f.acodec !== 'none' && f.acodec ? 'video+audio' : 'video') : 'audio'
  return parts.length ? parts.join(' · ') : type
}

export function codecLabel(f: FormatInfo): string {
  const v = f.vcodec && f.vcodec !== 'none' ? f.vcodec.split('.')[0] : null
  const a = f.acodec && f.acodec !== 'none' ? f.acodec.split('.')[0] : null
  if (v && a) return `${v} / ${a}`
  if (v) return v
  if (a) return a
  return f.ext
}

export interface BuildResult {
  formatId: string | undefined
  audioOnly: boolean
  label: string
}

/** Map a UI selection into download options. */
export function buildSelection(
  quality: string,
  bestVideo?: FormatInfo,
  bestAudio?: FormatInfo
): BuildResult {
  if (quality === 'audio') {
    return { formatId: undefined, audioOnly: true, label: 'Audio (MP3)' }
  }
  if (quality === 'best') {
    const v = bestVideo?.formatId
    const label = v
      ? `Best · ${formatLabel(bestVideo!)}`
      : 'Best quality (auto)'
    return { formatId: v ? `${v}+${bestAudio?.formatId || 'ba'}` : 'auto', audioOnly: false, label }
  }
  if (quality === 'video-noaudio') {
    return { formatId: 'bv*', audioOnly: false, label: 'Video (no audio)' }
  }
  // specific format id
  return { formatId: quality, audioOnly: false, label: quality }
}
