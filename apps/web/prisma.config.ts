import { defineConfig } from "@prisma/config";

// 兼容未安装 dotenv 的环境，避免类型检查失败
try {
  const dotenv = require("dotenv") as {
    config?: (options?: { path?: string }) => void;
  };
  dotenv.config?.({ path: "../../.env" });
} catch {
  // 忽略可选依赖缺失
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL || "",
  },
});
