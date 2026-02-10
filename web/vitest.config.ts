import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 必须使用 forks 模式，限制并发资源
    pool: 'forks',
    poolOptions: {
      forks: {
        // 限制最大并行 fork 数量，防止资源耗尽
        maxForks: 4,
      },
    },
    // 限制最大并发测试数
    maxConcurrency: 2,
    // 基础配置
    include: ['**/*.test.{ts,tsx,js,jsx}'],
    exclude: ['node_modules', '.next', 'coverage'],
    // 启用 coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // 全局测试 API
    globals: true,
  },
});
