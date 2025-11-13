/**
 * 分页相关工具函数
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * 解析分页参数
 */
export function parsePaginationParams(params: PaginationParams): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(params.page?.toString() || "1"));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(params.limit?.toString() || "20"))
  );
  const offset =
    params.offset !== undefined
      ? Math.max(0, parseInt(params.offset.toString()))
      : (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * 创建分页结果
 */
export function createPaginationResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResult<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * 从URL搜索参数中提取分页参数
 */
export function getPaginationFromSearch(
  searchParams: URLSearchParams
): PaginationParams {
  return {
    page: searchParams.get("page")
      ? parseInt(searchParams.get("page")!)
      : undefined,
    limit: searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : undefined,
    offset: searchParams.get("offset")
      ? parseInt(searchParams.get("offset")!)
      : undefined,
  };
}
