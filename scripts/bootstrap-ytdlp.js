// Downloads the latest yt-dlp binary and ffmpeg into resources/bin for VidDL.
// Run after installing deps: node scripts/bootstrap-ytdlp.js
import { execSync, exec } from 'child_process'
import { existsSync, mkdirSync, createWriteStream, rmSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const binDir = join(__dirname, '..', 'resources', 'bin')
mkdirSync(binDir, { recursive: true })

const isWin = process.platform === 'win32'
const ytDest = join(binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp')
const ffmpegDest = join(binDir, isWin ? 'ffmpeg.exe' : 'ffmpeg')

function need(name) {
  return process.env.FORCE === '1' || !existsSync(name)
}

async function httpGet(url, dest, label) {
  return new Promise((resolve, reject) => {
    function download(u, redirects = 0) {
      if (redirects > 5) return reject(new Error('Too many redirects'))
      https
        .get(u, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume()
            download(new URL(res.headers.location, u).toString(), redirects + 1)
            return
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}`))
          }
          const file = createWriteStream(dest)
          const total = Number(res.headers['content-length'] || 0)
          let received = 0
          res.on('data', (chunk) => {
            received += chunk.length
            if (total) process.stdout.write(`\r${label}: ${Math.round((received / total) * 100)}%`)
          })
          res.pipe(file)
          file.on('finish', () => {
            file.close()
            process.stdout.write(`\r${label}: done          \n`)
            resolve()
          })
          file.on('error', reject)
        })
        .on('error', reject)
    }
    download(url)
  })
}

async function main() {
  // 1) yt-dlp
  if (need(ytDest)) {
    const url = isWin
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
    console.log('Downloading yt-dlp...')
    await httpGet(url, ytDest, 'yt-dlp')
    if (!isWin) exec(`chmod +x "${ytDest}"`)
  } else {
    console.log(`yt-dlp already present (${ytDest})`)
  }

  // 2) ffmpeg (required for merging video+audio and converting audio)
  if (isWin && need(ffmpegDest)) {
    const zip = join(binDir, 'ffmpeg.zip')
    const url =
      'https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip'
    console.log('Downloading ffmpeg (bundled for merging)...')
    await httpGet(url, zip, 'ffmpeg')
    console.log('Extracting ffmpeg...')
    const extractDir = join(binDir, 'ffmpeg_extract')
    mkdirSync(extractDir, { recursive: true })
    execSync(`powershell -NoProfile -Command "Expand-Archive -Force -Path '${zip}' -DestinationPath '${extractDir}'"`)
    // locate ffmpeg.exe under extractDir/bin
    const candidates = []
    // recursive find
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.name === 'ffmpeg.exe' || e.name === 'ffprobe.exe') candidates.push(p)
      }
    }
    walk(extractDir)
    for (const c of candidates) {
      const name = c.split(/[\\/]/).pop()
      if (!existsSync(join(binDir, name))) {
        execSync(`copy /Y "${c}" "${join(binDir, name)}"`)
        console.log(`  -> ${name}`)
      }
    }
    rmSync(zip, { force: true })
    rmSync(extractDir, { recursive: true, force: true })
  } else if (isWin) {
    console.log(`ffmpeg already present (${ffmpegDest})`)
  } else {
    console.log('On non-Windows, install ffmpeg via your package manager (e.g. apt install ffmpeg).')
  }

  console.log('\nDone! VidDL is ready to download from 1000+ sites.')
}

main().catch((e) => {
  console.error('Bootstrap failed:', e.message)
  process.exit(1)
})
