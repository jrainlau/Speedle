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

    const res = await axios.head(url, { headers }).catch(e => e)
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
    return this.download(0, this.totalSize - 1)
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

  public async resume() {
    if (this.status !== DownloadStatus.PAUSED) {
      throw new Error(`Unable to call "resume()" because current download status is not ${DownloadStatus.PAUSED}`)
    }
    this.status = DownloadStatus.RESUMED
    this.config.onResume?.()
    return this.download(this.downloadedBytes, this.totalSize - 1)
  }

  public async cancel() {
    this.status = DownloadStatus.CANCELED
    this.controller?.cancel()
    this.config.onCancel?.()
    this.stream?.close?.()
    if (fs.existsSync(this.config.outputPath)) {
      fs.unlinkSync(this.config.outputPath)
    }
  }

  private async download(start, end) {
    if (this.status === DownloadStatus.PAUSED || this.status === DownloadStatus.CANCELED) return

    this.status = DownloadStatus.DOWNLOADING

    this.controller = axios.CancelToken.source()

    const { url, headers, timeout } = this.config

    const axiosRes = await axios.get(url, {
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
          this.status = DownloadStatus.COMPLETED
    
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

    return axiosRes
  }

  private async retry() {
    this.retryTimes -= 1
    this.status = DownloadStatus.RETRIED
    console.log('xxx')
    this.config.onRetry?.()
    return this.download(this.downloadedBytes, this.totalSize - 1)
  }
}

export default Speedle
