import { getNewOutputPath } from '../utils'
import * as fs from 'fs'

jest.mock('fs')

const mockFs = fs as jest.Mocked<typeof fs>

describe('getNewOutputPath', () => {
  it('returns original path if it does not exist.', () => {
    mockFs.existsSync.mockReturnValue(false)

    const res = getNewOutputPath('./test.md', 0)
    expect(res).toBe('./test.md')
  })

  it('returns new path with (1) suffix if original path exist', () => {
    mockFs.existsSync.mockImplementation(path => {
      return path === './test.md' ? true : false
    })

    const res = getNewOutputPath('./test.md', 0)
    expect(res).toBe('./test(1).md')
  })
})
