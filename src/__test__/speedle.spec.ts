import * as fs from 'fs-extra'
import { resolve } from 'path'
import Speedle from '../index'
import axios from 'axios'

const bigFilePath = `https://dldir1.qq.com/qqfile/qq/QQNT/5333e29d/QQ_v6.9.12-10951.dmg`
const downloadDir = resolve(__dirname, './download')

afterAll(() => {
  fs.removeSync(downloadDir)
})

describe('Speedle api test', () => {
  const onStart = jest.fn()
  const onProgress = jest.fn()
  const onPause = jest.fn()
  const onResume = jest.fn()
  const onComplete = jest.fn()
  const onError = jest.fn()
  const onCancel = jest.fn()

  const config = {
    url: bigFilePath,
    outputPath: resolve(downloadDir, 'QQ_v6.9.12-10951.dmg'),
    overwrite: false,
    resumable: true,
    timeout: 10 * 1000,
    retryTimes: 5,
    onStart,
    onProgress,
    onPause,
    onResume,
    onComplete,
    onError,
    onCancel,
  }

  const speedle = new Speedle(config)

  it('should start downloading', async () => {
    await speedle.start()
    expect(speedle.downloadStatus).toBe('DOWNLOADING')
    expect(onStart).toHaveBeenCalled()
  }, 1000 * 60 * 5)

  it('should pause downloading', async () => {
    await sleep(2000)
    await speedle.pause()
    expect(onProgress).toHaveBeenCalled()
    expect(speedle.downloadStatus).toBe('PAUSED')
    expect(onPause).toHaveBeenCalled()
  })

  it('should resume downloading', async () => {
    await sleep(2000)
    await speedle.resume()
    expect(speedle.downloadStatus).toBe('DOWNLOADING')
    expect(onResume).toHaveBeenCalled()
  })

  it('should cancel a download', async () => {
    await speedle.cancel()
    expect(speedle.downloadStatus).toBe('CANCELED')
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('Speedle on network error', () => {
  const onRetry = jest.fn()
  const onError = jest.fn()

  const config = {
    url: bigFilePath,
    outputPath: resolve(downloadDir, 'QQ_v6.9.12-10951.dmg'),
    overwrite: false,
    resumable: true,
    timeout: 1000,
    retryTimes: 3,
    onRetry,
    onError,
  }

  const speedle = new Speedle(config)

  it('should call onError function in network error', async () => {
    jest.spyOn(axios, 'get').mockImplementation(() => {
      return Promise.reject(new Error('Network Error'))
    });
    await speedle.start()
    await sleep(1000)
    expect(onError).toHaveBeenCalled()
    jest.restoreAllMocks()
  }, 100 * 60 * 5)
})

describe('Speedle download test', () => {
  const onStart = jest.fn()
  const onComplete = jest.fn()

  const config = {
    url: bigFilePath,
    outputPath: resolve(downloadDir, 'QQ_v6.9.12-10951.dmg'),
    overwrite: false,
    resumable: true,
    timeout: 10 * 1000,
    retryTimes: 5,
    onStart,
    onComplete,
  }

  const speedle = new Speedle(config)

  it('should start downloading', async () => {
    await speedle.start()
    await sleep(1000)
    expect(speedle.downloadStatus).toBe('DOWNLOADING')
    expect(onStart).toHaveBeenCalled()
    await waitUntilStatusChanged(speedle, 'COMPLETED')
    expect(onComplete).toHaveBeenCalled()
  }, 1000 * 60 * 5)
})

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function waitUntilStatusChanged(instance, targetStatus) {
  return new Promise(resolve => {
    const scanner = setInterval(() => {
      if (instance.downloadStatus === targetStatus) {
        resolve(1)
        clearInterval(scanner)
      }
    }, 100)
  })
}