import * as fs from 'fs'

export function getNewOutputPath(outputPath: string, count = 0): string {
  const regex = /(.*)\.(.*)$/
  const match = outputPath.match(regex) as RegExpMatchArray
  const filename = match[1]
  const ext = match[2]
  const checkedOutputPath = count > 0 ? `${filename}(${count}).${ext}` : outputPath
  if (fs.existsSync(checkedOutputPath)) {
    const newCount = count + 1
    return getNewOutputPath(outputPath, newCount)
  }
  return checkedOutputPath
}
