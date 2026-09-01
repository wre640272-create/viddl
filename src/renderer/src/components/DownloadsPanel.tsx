import { FolderOpen, X, CheckCircle2, XCircle, Clock, Loader2, Trash2, Play } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import type { DownloadTask } from '@shared/types'

interface DownloadsPanelProps {
  tasks: DownloadTask[]
}

const statusMeta: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  queued: { label: 'Queued', color: 'secondary', icon: <Clock className="h-3.5 w-3.5" /> },
  downloading: { label: 'Downloading', color: 'secondary', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  processing: { label: 'Processing', color: 'secondary', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  done: { label: 'Done', color: 'default', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  error: { label: 'Error', color: 'destructive', icon: <XCircle className="h-3.5 w-3.5" /> },
  cancelled: { label: 'Cancelled', color: 'outline', icon: <XCircle className="h-3.5 w-3.5" /> }
}

export function DownloadsPanel({ tasks }: DownloadsPanelProps) {
  const clearFinished = async () => {
    await window.api.clearFinished()
  }

  const remove = async (id: string) => {
    await window.api.removeTask(id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tasks.length} download{tasks.length === 1 ? '' : 's'} in this session
        </p>
        <Button variant="outline" size="sm" onClick={clearFinished}>
          <Trash2 className="h-4 w-4" /> Clear finished
        </Button>
      </div>

      {tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <DownloadIcon />
            <p className="mt-4 text-sm font-medium">No downloads yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Paste a video URL in the "New Download" tab and start downloading.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
            const meta = statusMeta[t.status] ?? statusMeta.queued
            return (
              <Card key={t.id}>
                <CardContent className="space-y-3 pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="truncate">{t.url}</span>
                        {t.formatLabel && <span>· {t.formatLabel}</span>}
                        {t.ext && <span>· {t.ext.toUpperCase()}</span>}
                      </div>
                    </div>
                    <Badge variant={meta.color as 'default' | 'secondary' | 'destructive' | 'outline'} className="gap-1">
                      {meta.icon} {meta.label}
                    </Badge>
                  </div>

                  {(t.status === 'downloading' || t.status === 'processing' || t.status === 'queued') && (
                    <div className="space-y-1.5">
                      <Progress value={t.progress} />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t.progress}%</span>
                        <span className="flex items-center gap-3">
                          {t.speed && <span>{t.speed}/s</span>}
                          {t.eta && <span>ETA {t.eta}</span>}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => window.api.cancelDownload(t.id)}
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {t.status === 'error' && (
                    <p className="max-h-24 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive-foreground">
                      {t.error}
                    </p>
                  )}

                  {t.status === 'done' && t.filePath && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => window.api.showInFolder(t.filePath!)}
                      >
                        <FolderOpen className="h-3.5 w-3.5" /> Show in folder
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => window.api.openPath(t.filePath!)}
                      >
                        <Play className="h-3.5 w-3.5" /> Open file
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => remove(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  )}

                  {t.status === 'cancelled' && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => remove(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  )}

                  <Separator className="!my-2" />
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(t.createdAt).toLocaleTimeString()}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DownloadIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-2xl text-muted-foreground">
      ⬇
    </div>
  )
}
