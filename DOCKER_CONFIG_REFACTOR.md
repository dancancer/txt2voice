# Docker 配置重构总结

## 🎯 重构目标

将 Docker 启动默认配置改为开发服务器模式，当前配置改名为生产配置。

## 📋 变更内容

### 1. 文件重命名
- `docker-compose.yml` → `docker-compose.prod.yml` (生产环境配置)
- `docker-compose.dev.yml` → `docker-compose.yml` (开发环境配置，新的默认配置)

### 2. 配置差异

#### 开发环境 (`docker-compose.yml`)
- **Web 服务**: 使用 `Dockerfile.dev`，支持热更新
- **环境变量**: `NODE_ENV=development`
- **调试配置**: `DEBUG=True`, `LOG_LEVEL=DEBUG`
- **文件挂载**: 挂载源代码目录，支持实时编辑
- **轮询配置**: `WATCHPACK_POLLING=true`, `CHOKIDAR_USEPOLLING=true`

#### 生产环境 (`docker-compose.prod.yml`)
- **Web 服务**: 使用 `Dockerfile`，优化构建
- **环境变量**: `NODE_ENV=production`
- **调试配置**: `DEBUG=False`, `LOG_LEVEL=INFO`
- **文件挂载**: 仅挂载必要目录，无源代码挂载
- **性能优化**: 移除开发相关的轮询配置

### 3. 脚本命令更新

#### 开发环境命令 (默认)
```bash
pnpm docker:up      # 启动开发环境
pnpm docker:down    # 停止开发环境
pnpm docker:build   # 构建开发环境
pnpm docker:logs    # 查看开发环境日志
```

#### 生产环境命令
```bash
pnpm docker:prod        # 启动生产环境
pnpm docker:prod:down   # 停止生产环境
pnpm docker:prod:build # 构建生产环境
pnpm docker:prod:logs  # 查看生产环境日志
```

### 4. 文档更新

- **README.md**: 更新项目结构和部署说明
- **DOCKER_DEV_QUICKSTART.md**: 更新命令和配置引用
- **package.json**: 更新脚本命令

## 🚀 使用方式

### 开发环境 (默认)
```bash
# 启动开发环境（支持热更新）
pnpm docker:up

# 访问应用
open http://localhost:3001
```

### 生产环境
```bash
# 启动生产环境（优化性能）
pnpm docker:prod

# 访问应用
open http://localhost:3001
```

## ✅ 验证结果

- ✅ 两个配置文件语法验证通过
- ✅ 开发环境支持热更新和调试
- ✅ 生产环境优化了性能和安全性
- ✅ 所有文档和脚本已更新
- ✅ 向后兼容性保持良好

## 📝 注意事项

1. **默认行为改变**: 现在 `docker-compose up` 默认启动开发环境
2. **端口配置**: 两个环境都使用相同的端口映射 (3001)
3. **环境变量**: 确保在 `.env` 文件中正确配置所有必需变量
4. **版本警告**: Docker Compose 提示 `version` 属性已过时，但为了兼容性暂时保留

## 🔧 故障排查

如果遇到问题，请参考：
- [Docker 开发环境快速启动](./DOCKER_DEV_QUICKSTART.md)
- [README.md](./README.md) 中的 Docker 部署部分
