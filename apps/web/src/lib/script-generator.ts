// 一旦我被更新，请更新我的开头注释
// input: 无
// output: 旧脚本生成兼容导出
// pos: 兼容层
export interface LegacyScriptGenerator {
  setExecutionObserver?: (...args: unknown[]) => void;
  generateScript?: (...args: unknown[]) => Promise<unknown>;
  generatePartialScript?: (...args: unknown[]) => Promise<unknown>;
  regenerateSegmentScript?: (...args: unknown[]) => Promise<unknown>;
}

export const getScriptGenerator = (): LegacyScriptGenerator => {
  throw new Error("Legacy script generator entry has been removed");
};
