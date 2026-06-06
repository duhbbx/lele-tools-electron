import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: [
      'packages/**/src/**/*.test.ts',
      'apps/**/src/**/*.test.ts',
      // 私有插件（目录可能不存在，glob 为空即可）
      'plugins/*/**/*.test.ts',
    ],
    environment: 'node',
  },
})
