import typescript from 'rollup-plugin-typescript2'
import { generateDtsBundle } from 'rollup-plugin-dts-bundle-generator'

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
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
