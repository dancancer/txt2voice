import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
    public details?: any
  ) {
    super(message);
    this.name = "APIError";
  }
}

export class FileProcessingError extends APIError {
  constructor(
    message: string,
    public code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "CORRUPTED_FILE",
    details?: any
  ) {
    super(message, 400, code, details);
  }
}

export class TTSError extends APIError {
  constructor(
    message: string,
    public code:
      | "TTS_SERVICE_DOWN"
      | "QUOTA_EXCEEDED"
      | "VOICE_NOT_SUPPORTED"
      | "TTS_SYNTHESIS_FAILED",
    public provider: string,
    public retryable: boolean = false
  ) {
    super(message, retryable ? 503 : 502, code);
  }
}

export class ValidationError extends APIError {
  constructor(message: string, field?: string) {
    super(message, 400, "VALIDATION_ERROR", { field });
  }
}

function getFileErrorMessage(code: string): string {
  const messages = {
    FILE_TOO_LARGE: "文件大小超过20MB限制",
    INVALID_FORMAT: "不支持的文件格式，请上传.txt或.md文件",
    CORRUPTED_FILE: "文件损坏或无法读取，请检查文件完整性",
  };
  return messages[code as keyof typeof messages] || "文件处理错误";
}

// 全局错误处理中间件
export function handleAPIError(
  error: unknown,
  request?: NextRequest
): NextResponse {
  const logger = console; // 在实际项目中使用更完善的日志系统

  if (error instanceof ZodError) {
    logger.warn("Validation error", {
      error: error.message,
      field: error.issues[0]?.path?.join("."),
      url: request?.url,
    });
    return NextResponse.json(
      {
        error: {
          message: "请求参数验证失败",
          code: "VALIDATION_ERROR",
          details: {
            field: error.issues[0]?.path?.join("."),
            message: error.issues[0]?.message,
          },
        },
      },
      { status: 400 }
    );
  }

  if (error instanceof FileProcessingError) {
    logger.warn("File processing error", {
      error: error.message,
      code: error.code,
      url: request?.url,
    });
    return NextResponse.json(
      {
        error: {
          message: getFileErrorMessage(error.code),
          code: error.code,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof TTSError) {
    logger.error("TTS service error", {
      error: error.message,
      provider: error.provider,
      retryable: error.retryable,
    });

    return NextResponse.json(
      {
        error: {
          message: error.retryable
            ? "TTS服务暂时不可用，已加入重试队列"
            : "TTS服务错误",
          code: error.code,
          provider: error.provider,
          retryable: error.retryable,
        },
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof APIError) {
    logger.error("API error", {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    });
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  // 默认服务器错误
  logger.error("Unexpected error", {
    error: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
    url: request?.url,
  });

  return NextResponse.json(
    {
      error: {
        message: "服务器内部错误",
        code: "INTERNAL_SERVER_ERROR",
      },
    },
    { status: 500 }
  );
}

// API路由包装器
export function withErrorHandler(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    ...args: any[]
  ): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return handleAPIError(error, request);
    }
  };
}
