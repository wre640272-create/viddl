import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, History, Video, Cpu, AlertTriangle } from 'lucide-react'
import { ToastProvider } from '@/components/ui/toast'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { NewDownload } from '@/components/NewDownload'
import { DownloadsPanel } from '@/components/DownloadsPanel'
import type { DownloadTask } from '@shared/types'

export default function App() {
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [appVersion, setAppVersion] = useState('')
  const [dlVersion, setDlVersion] = useState<string | null>(null)
  const [hasFfmpeg, setHasFfmpeg] = useState(true)
  const tasksRef = useRef<DownloadTask[]>([])

  const syncTasks = useCallback((next: DownloadTask[]) => {
    tasksRef.current = next
    setTasks(next)
  }, [])

  const applyTask = useCallback((t: DownloadTask) => {
    const exists = tasksRef.current.some((x) => x.id === t.id)
    const next = exists
      ? tasksRef.current.map((x) => (x.id === t.id ? t : x))
      : [t, ...tasksRef.current]
    syncTasks(next)
  }, [syncTasks])

  useEffect(() => {
    window.api.getAppVersion().then(setAppVersion)
    window.api.getDownloaderVersion().then(setDlVersion)
    window.api.hasFfmpeg().then(setHasFfmpeg)
    window.api.getTasks().then(syncTasks)

    const offTask = window.api.onTask(applyTask)
    return () => {
      offTask()
    }
  }, [applyTask, syncTasks])

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">VidDL</h1>
              <p className="text-xs text-muted-foreground">The best video downloader, powered by yt-dlp</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {dlVersion && (
              <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1">
                <Cpu className="h-3.5 w-3.5" /> engine {dlVersion}
              </span>
            )}
            {!hasFfmpeg && (
              <span
                className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-amber-300"
                title="ffmpeg is required for audio conversion and video+audio merging"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> ffmpeg missing
              </span>
            )}
            <span className="rounded-full border border-border px-2.5 py-1">v{appVersion || '1.0'}</span>
          </div>
        </header>

        <main className="flex flex-1 flex-col p-6">
          <Tabs defaultValue="new">
            <TabsList>
              <TabsTrigger value="new" className="gap-2">
                <Video className="h-4 w-4" /> New Download
              </TabsTrigger>
              <TabsTrigger value="downloads" className="gap-2">
                <History className="h-4 w-4" /> Downloads ({tasks.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="mt-4">
              <NewDownload tasks={tasks} />
            </TabsContent>
            <TabsContent value="downloads" className="mt-4">
              <DownloadsPanel tasks={tasks} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ToastProvider>
  )
}
