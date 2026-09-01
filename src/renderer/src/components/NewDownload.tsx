import { useState } from 'react'
import { ClipboardPaste, FolderOpen, Loader2, Download, Link2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatBytes, formatDuration, formatLabel } from '@/lib/formats'
import type { DownloadOptions, DownloadTask, ProbeResult, VideoInfo } from '@shared/types'

interface NewDownloadProps {
  tasks: DownloadTask[]
}

type DownloadMode = 'video' | 'audio' | 'best' | 'specific'

export function NewDownload({ tasks }: NewDownloadProps) {
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [probing, setProbing] = useState(false)
  const [probe, setProbe] = useState<ProbeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quality, setQuality] = useState('best')
  const [specificFormat, setSpecificFormat] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [starting, setStarting] = useState(false)

  const mode: DownloadMode =
    quality === 'audio' ? 'audio' : quality === 'best' ? 'best' : quality === 'video-noaudio' ? 'best' : 'specific'

  const handleProbe = async (target?: string) => {
    const u = (target ?? url).trim()
    if (!u) return
    setProbing(true)
    setError(null)
    setProbe(null)
    try {
      const res = await window.api.probe(u)
      if (!res) throw new Error('No media found at this URL')
      setProbe(res)
      setUrl(u)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setProbing(false)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrl(text.trim())
        await handleProbe(text.trim())
      }
    } catch {
      toast({ kind: 'info', title: 'Clipboard not accessible', description: 'Paste the URL manually.' })
    }
  }

  const handleSelectDir = async () => {
    const dir = await window.api.selectDirectory()
    if (dir) setOutputDir(dir)
  }

  const getDefaultDir = async () => {
    if (!outputDir) setOutputDir(await window.api.getDefaultDirectory())
  }
  void getDefaultDir()

  const info: VideoInfo | null = probe?.info ?? null

  const videoFormats = info?.formats.filter((f) => f.isVideo) ?? []
  const highQuality = videoFormats.filter((f) => (f.height || 0) >= 720)

  const startDownload = async (selection?: { formatId?: string; audioOnly?: boolean; label: string }) => {
    if (!info) return
    setStarting(true)
    const opts: DownloadOptions = {
      outputDir: outputDir || undefined
    }
    let label = 'Download'
    if (selection) {
      opts.formatId = selection.formatId
      opts.audioOnly = selection.audioOnly
      label = selection.label
    } else if (mode === 'audio') {
      opts.audioOnly = true
      label = 'Audio (MP3)'
    } else if (mode === 'best') {
      const v = info.bestVideo?.formatId
      const a = info.bestAudio?.formatId
      opts.formatId = v ? `${v}+${a || 'ba'}` : 'auto'
      label = `Best · ${info.bestVideo ? formatLabel(info.bestVideo) : 'auto'}`
    } else if (mode === 'specific') {
      opts.formatId = specificFormat || 'bv*+ba'
      label = specificFormat || 'Automatic'
    }
    try {
      await window.api.startDownload(info.webpageUrl || url, { ...opts, formatLabel: label })
      toast({ kind: 'success', title: 'Download started', description: info.title })
    } catch (e) {
      toast({ kind: 'error', title: 'Failed to start download', description: (e as Error).message })
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* URL input card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3">
            <Label htmlFor="url" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Paste a video URL from any site
            </Label>
            <div className="flex gap-2">
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleProbe()}
                placeholder="https://youtube.com/watch?v=...  (YouTube, Vimeo, Twitter/X, TikTok, Twitch, and 1000+ more)"
                className="h-12 flex-1 text-base"
              />
              <Button variant="outline" size="icon" className="h-12 w-12" title="Paste URL" onClick={handlePaste}>
                <ClipboardPaste className="h-5 w-5" />
              </Button>
              <Button className="h-12 px-6" onClick={() => handleProbe()} disabled={probing || !url.trim()}>
                {probing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
                {probing ? 'Fetching…' : 'Fetch URL'}
              </Button>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="break-all">{error}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Media preview */}
      {info && (
        <Card>
          <CardContent className="flex flex-col gap-5 pt-6 md:flex-row">
            <div className="shrink-0 overflow-hidden rounded-lg border border-border bg-muted md:w-64">
              {info.thumbnail ? (
                <img
                  src={info.thumbnail}
                  alt={info.title}
                  className="aspect-video w-full object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-muted-foreground">
                  <VideoIcon />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h2 className="text-lg font-semibold leading-snug">{info.title}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {info.uploader && <span>{info.uploader}</span>}
                  {info.duration && (
                    <>
                      <span>·</span>
                      <span>{formatDuration(info.duration)}</span>
                    </>
                  )}
                  {info.viewCount !== undefined && (
                    <>
                      <span>·</span>
                      <span>{formatCount(info.viewCount)} views</span>
                    </>
                  )}
                  {info.bestVideo && (
                    <Badge variant="secondary" className="ml-1">
                      Up to {info.bestVideo.height || ''}p
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Options */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Quality</Label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="best">
                        Best available {info.bestVideo && `(${info.bestVideo.height || '?'}p)`}
                      </SelectItem>
                      <SelectItem value="video-noaudio">Video, no audio</SelectItem>
                      <SelectItem value="audio">Audio only (MP3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {mode === 'specific' && (
                  <div className="space-y-1.5 md:col-span-1">
                    <Label>Format</Label>
                    <Select value={specificFormat || undefined} onValueChange={setSpecificFormat}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select format…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {highQuality.slice(0, 60).map((f) => (
                          <SelectItem key={f.formatId} value={f.formatId}>
                            {formatLabel(f) || f.formatId} · {f.ext.toUpperCase()} ·{' '}
                            {formatBytes(f.filesize)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Download to</Label>
                  <div className="flex gap-2">
                    <Input
                      value={outputDir}
                      readOnly
                      placeholder="Default Downloads/VidDL"
                      className="truncate"
                    />
                    <Button variant="outline" size="icon" onClick={handleSelectDir} title="Choose folder">
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  className="h-12 flex-1 gap-2"
                  disabled={starting}
                  onClick={() => startDownload()}
                >
                  {starting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Download className="h-5 w-5" />
                  )}
                  {starting ? 'Starting…' : 'Download'}
                </Button>
                <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
                  {info.formats.length} formats available
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active downloads */}
      {tasks.filter((t) => t.status === 'downloading' || t.status === 'processing' || t.status === 'queued').length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="text-sm font-semibold text-muted-foreground">Active downloads</h3>
            {tasks
              .filter((t) => ['downloading', 'processing', 'queued'].includes(t.status))
              .map((t) => (
                <div key={t.id} className="space-y-1.5 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{t.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {t.status === 'downloading' && t.progress != null ? `${t.progress}%` : t.status}
                    </span>
                  </div>
                  <Progress value={t.progress} />
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function VideoIcon() {
  return <span className="text-4xl font-black">🎬</span>
}

function formatCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}
