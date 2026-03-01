// 一旦我被更新，请更新我的开头注释
// input: HTTP 请求头/环境变量
// output: 重放鉴权结果
// pos: 任务重放鉴权工具
import { NextRequest } from "next/server";
import { APIError } from "@/lib/error-handler";

const REPLAY_TOKEN_ENV_KEY = "TASK_REPLAY_API_TOKEN";
const REPLAY_TOKEN_HEADER = "x-txt2voice-replay-token";
const AUTHORIZATION_PREFIX = "Bearer ";

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization || !authorization.startsWith(AUTHORIZATION_PREFIX)) {
    return null;
  }

  const token = authorization.slice(AUTHORIZATION_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

function getReplayTokenFromRequest(request: NextRequest): string | null {
  const headerToken = request.headers.get(REPLAY_TOKEN_HEADER)?.trim();
  if (headerToken) {
    return headerToken;
  }

  return getBearerToken(request);
}

export function assertReplayPermission(request: NextRequest): void {
  const expectedToken = process.env[REPLAY_TOKEN_ENV_KEY]?.trim();
  if (!expectedToken) {
    throw new APIError(
      `任务重放未启用，请先配置 ${REPLAY_TOKEN_ENV_KEY}`,
      403,
      "REPLAY_DISABLED"
    );
  }

  const token = getReplayTokenFromRequest(request);
  if (!token) {
    throw new APIError(
      `缺少任务重放凭证，请通过 ${REPLAY_TOKEN_HEADER} 或 Authorization 传入`,
      401,
      "UNAUTHORIZED"
    );
  }

  if (token !== expectedToken) {
    throw new APIError("任务重放凭证无效", 403, "FORBIDDEN");
  }
}

export const replayAuthContract = {
  envKey: REPLAY_TOKEN_ENV_KEY,
  header: REPLAY_TOKEN_HEADER,
} as const;
