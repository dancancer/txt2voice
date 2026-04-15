import next from 'eslint-config-next'

const config = [
  {
    ignores: ['node_modules', '.next', '.mastra', 'dist', 'coverage'],
  },
  ...next,
]

export default config
