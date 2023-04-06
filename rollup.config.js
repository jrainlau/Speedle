const typescript = require('rollup-plugin-typescript2')
const { generateDtsBundle } = require('rollup-plugin-dts-bundle-generator')

module.exports = {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'umd',
    name: 'Speedle',
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
    }),
    generateDtsBundle({
      outFile: 'dist/@types/index.d.ts'
    })
  ],
  external: ['fs', 'path', 'util', 'axios']
}
