import next from 'eslint-config-next'

const config = [
  {
    ignores: ['node_modules', '.next', 'dist', 'coverage'],
  },
  ...next,
]

export default config
