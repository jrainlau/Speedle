import type { SpeedleConfig } from './types'
import axios, { CancelTokenSource } from 'axios'
import * as pathUtils from 'path'
import * as fs from 'fs'
import { getNewOutputPath } from './utils'

enum DownloadStatus {
  DOWNLOADING = 'DOWNLOADING',
  PAUSED = 'PAUSED',
  RESUMED = 'RESUMED',
  RETRIED = 'RETRIED',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
}

const defaultConfig: SpeedleConfig = {
  url: '',
  outputPath: '',
  overwrite: false,
  resumable: true,
  timeout: 10 * 1000,
  retryTimes: 5,
}

/**
 * Create a new instance of Speedle
 */
class Speedle {
  private config: SpeedleConfig
  private controller: CancelTokenSource
  private stream: fs.WriteStream
  private downloadedBytes: number = 0
  private totalSize: number = 0
  private timer: NodeJS.Timeout
  private retryTimes: number
  private status: DownloadStatus

  constructor(customConfig: SpeedleConfig) {
    this.config = { ...defaultConfig, ...customConfig }
  }

  get downloadStatus() {
    return this.status
  }

  public async start() {
    if (this.status === DownloadStatus.DOWNLOADING) {
      throw new Error(`Unable to call "start()" because current download status is ${DownloadStatus.DOWNLOADING}`)
    }

    const { url, headers, overwrite, outputPath, retryTimes } = this.config

    this.retryTimes = retryTimes!

    this.config.onStart?.()

    const res = await axios.head(url, { headers })
    if (res.status !== 200) {

      this.config?.onError?.(res);
      return
    }

    this.totalSize = parseInt(res.headers['content-length']!, 10)

    const dirPath = pathUtils.dirname(outputPath)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    let finalOutputPath = outputPath
    if (overwrite && fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath)
    } else if (!overwrite && fs.existsSync(outputPath)) {
      finalOutputPath = getNewOutputPath(outputPath)
    }

    this.stream = fs.createWriteStream(finalOutputPath, { flags: 'a' })
    this.download(0, this.totalSize - 1)
  }

  public pause() {
    if (this.status !== DownloadStatus.DOWNLOADING) {
      throw new Error(`Unable to call "pause()" because current download status is not ${DownloadStatus.DOWNLOADING}`)
    }
    this.status = DownloadStatus.PAUSED
    clearTimeout(this.timer)
    this.controller?.cancel('pause by user.')
    this.config.onPause?.()
  }

  public resume() {
    if (this.status !== DownloadStatus.PAUSED) {
      throw new Error(`Unable to call "resume()" because current download status is not ${DownloadStatus.PAUSED}`)
    }
    this.status = DownloadStatus.RESUMED
    this.config.onResume?.()
    this.download(this.downloadedBytes, this.totalSize - 1)
  }

  public async cancel() {
    if (this.status !== DownloadStatus.DOWNLOADING) {
      throw new Error(`Unable to call "resume()" because current download status is not ${DownloadStatus.DOWNLOADING}`)
    }

    this.status = DownloadStatus.CANCELED
    this.controller?.cancel()
    fs.unlinkSync(this.config.outputPath)
  }

  private async download(start, end) {
    if (this.status === DownloadStatus.PAUSED || this.status === DownloadStatus.CANCELED) return

    this.status = DownloadStatus.DOWNLOADING

    this.controller = axios.CancelToken.source()

    const { url, headers, timeout } = this.config

    axios({
      method: 'get',
      url,
      headers: {
        ...headers,
        Range: `bytes=${start}-${end}`
      },
      responseType: 'stream',
      cancelToken: this.controller.token,
      onDownloadProgress: (progressEvent) => {
        this.downloadedBytes = progressEvent.loaded
        this.config.onProgress?.(progressEvent)
        clearTimeout(this.timer)
        if (this.status === DownloadStatus.PAUSED || this.status === DownloadStatus.CANCELED) return
        this.timer = setTimeout(() => {
          if (this.retryTimes > 0) {
            this.retry()
          } else {
            this.cancel()
          }
        }, timeout);
      }
    })
      .then(response => {
        response.data.pipe(this.stream)

        response.data.on('close', () => {
          if (this.status === DownloadStatus.PAUSED || this.status === DownloadStatus.CANCELED) return
          clearTimeout(this.timer)
    
          this.config.onComplete?.()
        })

        response.data.on('error', error => {
          if (axios.isCancel(error)) return
  
          this.status = DownloadStatus.CANCELED
          this.config.onError?.(error)
        })
      })
      .catch(error => {
        if (axios.isCancel(error)) return

        this.status = DownloadStatus.CANCELED
        this.config.onError?.(error)
      })
  }

  private retry() {
    this.retryTimes -= 1
    this.status = DownloadStatus.RETRIED
    this.download(this.downloadedBytes, this.totalSize - 1)
  }
}

export default Speedle
