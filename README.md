# VidDL

The best video downloader — any site, any quality. A beautiful cross-platform desktop app that downloads videos and audio from **1000+ sites** (YouTube, Vimeo, Twitter/X, TikTok, Twitch, Instagram, and more) in **any available quality**, up to 4K and beyond.

Built with **Electron + React + TypeScript + Tailwind + shadcn/ui**, powered by the legendary **yt-dlp** engine.

## Features

- **Any site** — leverages yt-dlp, which supports virtually every video site on the internet (playlists excluded by default).
- **Any quality** — probes the source and lists every available format. Auto-picks the best video + audio stream, or you can pick an explicit resolution/format.
- **Audio extraction** — download as high-quality MP3 (requires bundled ffmpeg).
- **Live progress** — real-time progress bar, download speed, and ETA for every active download.
- **Concurrent downloads** — start multiple downloads and track them all in one place.
- **Choose your destination** — default folder is `Downloads/VidDL`, override per download.
- **Open / show in folder** — jump straight to finished files.
- **Self-contained engine** — bundles `yt-dlp` and `ffmpeg` so it works offline out of the box.

## Screenshots

(Add screenshots here.)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Windows / macOS / Linux

### Install & run

```bash
# 1. Install dependencies
npm install

# 2. Bootstrap the engine (downloads yt-dlp + ffmpeg into resources/bin)
npm run bootstrap

# 3. Start the app in dev mode
npm run dev
```

### Production build & package

```bash
npm run build              # typecheck + bundle
npm run package            # build Windows installer/portable via electron-builder
```

## The engine (yt-dlp)

VidDL bundles the latest [yt-dlp](https://github.com/yt-dlp/yt-dlp) binary and, on Windows, a static [FFmpeg](https://github.com/BtbN/FFmpeg-Builds) build. If the bundled binaries are ever missing, the app falls back to resolving `yt-dlp` from your system `PATH`.

To refresh the bundled binaries:

```bash
FORCE=1 npm run bootstrap
```

## Project structure

```
src/
  main/            Electron main process (IPC, window, downloader core)
    downloader/    yt-dlp/ffmpeg wrapping, probing, progress parsing
  preload/         Secure context-bridge API for the renderer
  renderer/        React + Tailwind + shadcn/ui app
    src/
      components/  UI components (NewDownload, DownloadsPanel, ui/*)
      lib/         Formatting + option-mapping helpers
  shared/          Types shared between main & renderer
scripts/
  bootstrap-ytdlp.js   Downloads yt-dlp + ffmpeg into resources/bin
resources/bin/     Bundled engine binaries (generated)
```

## Disclaimer

Only download content you have the right to download. Respect each site's terms of service and applicable copyright law.

## License

MIT
