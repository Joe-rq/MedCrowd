// 基础示例测试 - 验证 Vitest 基础设施可用
describe('示例测试套件', () => {
  it('应该通过基本相等性测试', () => {
    expect(1 + 1).toBe(2);
  });

  it('应该通过字符串测试', () => {
    const greeting = 'Hello, Vitest!';
    expect(greeting).toContain('Vitest');
  });

  it('应该通过数组测试', () => {
    const numbers = [1, 2, 3, 4, 5];
    expect(numbers).toHaveLength(5);
    expect(numbers).toContain(3);
  });

  it('应该通过对象测试', () => {
    const user = { name: 'MedCrowd', version: '0.1.0' };
    expect(user).toHaveProperty('name');
    expect(user.name).toBe('MedCrowd');
  });

  it('应该通过异步测试', async () => {
    const result = await Promise.resolve('async success');
    expect(result).toBe('async success');
  });
});

describe('数组操作测试', () => {
  const setupTestData = () => [10, 20, 30, 40, 50];

  it('应该正确计算数组总和', () => {
    const data = setupTestData();
    const sum = data.reduce((a, b) => a + b, 0);
    expect(sum).toBe(150);
  });

  it('应该正确过滤数组', () => {
    const data = setupTestData();
    const filtered = data.filter(n => n > 25);
    expect(filtered).toEqual([30, 40, 50]);
  });
});
