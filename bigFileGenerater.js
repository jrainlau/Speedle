const fs = require('fs')

function generateFile(path, size) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(path)

    const chunkSize = 1024 * 1024 // 1MB
    const iterations = Math.ceil(size / chunkSize)

    for (let i = 0; i < iterations; i++) {
      const chunk = Buffer.alloc(chunkSize, Math.random().toString(36).substring(2))
      stream.write(chunk)
    }

    stream.on('finish', () => {
      resolve()
    })

    stream.on('error', (err) => {
      reject(err)
    })

    stream.end()
  })
}

generateFile('./big.txt', 100 * 1024 * 1024)
