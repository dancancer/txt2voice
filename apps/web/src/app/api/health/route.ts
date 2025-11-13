import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // 检查数据库连接
    const dbStatus = await checkDatabaseConnection();

    // 检查其他依赖服务
    const servicesStatus = await checkServices();

    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbStatus,
        ...servicesStatus,
      },
    };

    // 如果有任何服务不健康，返回 503 状态
    const hasUnhealthyService = Object.values(healthStatus.services).some(
      (service: any) => service.status !== "healthy"
    );

    if (hasUnhealthyService) {
      healthStatus.status = "degraded";
      return NextResponse.json(healthStatus, { status: 503 });
    }

    return NextResponse.json(healthStatus);
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}

async function checkDatabaseConnection() {
  try {
    // 这里可以添加数据库连接检查逻辑
    // 例如：prisma.$queryRaw`SELECT 1`
    return {
      status: "healthy",
      message: "Database connection OK",
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message:
        error instanceof Error ? error.message : "Database connection failed",
    };
  }
}

async function checkServices() {
  const services: Record<string, any> = {};

  // 检查字符识别服务
  try {
    // 这里可以添加对字符识别服务的健康检查
    services.characterRecognition = {
      status: "healthy",
      message: "Character recognition service OK",
    };
  } catch (error) {
    services.characterRecognition = {
      status: "unhealthy",
      message:
        error instanceof Error
          ? error.message
          : "Character recognition service unavailable",
    };
  }

  return services;
}
