// 一旦我被更新，请更新我的开头注释
// input: 运行时错误对象与可选中断信号
// output: 请求错误类型判断结果
// pos: 共享业务库

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

export const isFetchInterruptedError = (error: unknown): boolean =>
  error instanceof TypeError && error.message === "Failed to fetch";

export const isRequestCanceled = (
  error: unknown,
  signal?: AbortSignal
): boolean => Boolean(signal?.aborted) || isAbortError(error);
