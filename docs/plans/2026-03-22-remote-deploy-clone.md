# Remote Deploy Clone Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `192.168.88.9` 建立专用 deploy 目录，并把远端发布收敛为 `git pull + docker compose up/restart + 健康检查` 的可复现流程。

**Architecture:** 在远端新增一个干净的 deploy clone 目录，和当前脏开发目录分离。仓库内新增一个可 dry-run 的发布脚本，负责远端 clone/bootstrap、`git fetch/pull --ff-only`、`.env` 链接校验、`web` 服务重建/重启、健康检查；同时把运行手册改成只推荐这条路径。

**Tech Stack:** Bash, SSH, git, rsync-free remote pull workflow, Docker Compose, Node built-in test runner.

---

### Task 1: 为远端发布脚本写失败测试

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/scripts/__tests__/deploy-remote-web.test.js`
- Test: `/Users/xupeng/mycode/txt2voice/scripts/__tests__/deploy-remote-web.test.js`

**Step 1: Write the failing test**

写 `node:test` 用例，断言脚本在 `--dry-run` 下会输出：
- bootstrap clone 命令
- `git pull --ff-only`
- `.env` 链接校验
- `docker compose up -d web`
- 健康检查 URL

**Step 2: Run test to verify it fails**

Run: `node --test scripts/__tests__/deploy-remote-web.test.js`

Expected: FAIL，因为脚本还不存在。

**Step 3: Write minimal implementation**

新增一个支持 `--dry-run` 的发布脚本，先只满足测试输出。

**Step 4: Run test to verify it passes**

Run: `node --test scripts/__tests__/deploy-remote-web.test.js`

Expected: PASS

### Task 2: 落地专用 deploy clone 发布脚本

**Files:**
- Create: `/Users/xupeng/mycode/txt2voice/scripts/deploy-remote-web.sh`
- Modify: `/Users/xupeng/mycode/txt2voice/package.json`
- Test: `/Users/xupeng/mycode/txt2voice/scripts/__tests__/deploy-remote-web.test.js`

**Step 1: Extend the failing test**

补充测试，断言：
- 默认远端目录是 `/root/deploy/txt2voice-web`
- 默认 `.env` 来源是 `/root/code/txt2voice/.env`
- 支持 `--branch`/`--host`/`--remote-dir`
- 使用 `docker compose up -d web` 而不是全栈重建

**Step 2: Run test to verify it fails**

Run: `node --test scripts/__tests__/deploy-remote-web.test.js`

Expected: FAIL，因为参数和命令还不完整。

**Step 3: Write minimal implementation**

实现脚本：
- 本地解析参数与 preflight
- 远端 clone/bootstrap
- `git fetch` + `checkout` + `pull --ff-only`
- `.env` 链接存在性检查
- `docker compose up -d web`
- 健康检查轮询

**Step 4: Run test to verify it passes**

Run: `node --test scripts/__tests__/deploy-remote-web.test.js`

Expected: PASS

### Task 3: 更新远端运行手册

**Files:**
- Modify: `/Users/xupeng/mycode/txt2voice/docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`

**Step 1: Write the docs change**

增加“专用 deploy clone”章节，明确：
- 开发目录和 deploy 目录分离
- 以后默认使用新脚本
- 不再推荐手工 `rsync` 作为日常发布路径

**Step 2: Verify docs are consistent**

Run: `rg -n "rsync -av apps/web/src/|deploy clone|deploy-remote-web" docs/technical/REMOTE_TTS_RUNTIME_RUNBOOK.md`

Expected: 新流程可见，旧流程被降级为应急手段。

### Task 4: 真实 bootstrap 与 dry-run/health 验证

**Files:**
- Verify only

**Step 1: Dry run the script locally**

Run: `bash scripts/deploy-remote-web.sh --dry-run --branch <branch>`

Expected: 输出完整远端发布计划，不执行真实修改。

**Step 2: Bootstrap remote deploy clone**

Run: `bash scripts/deploy-remote-web.sh --branch <branch>`

Expected:
- 远端创建 `/root/deploy/txt2voice-web`
- 成功完成 `git pull --ff-only`
- `txt2voice-web` 服务重启或重建成功

**Step 3: Verify remote state**

Run:

```bash
ssh 192.168.88.9 'cd /root/deploy/txt2voice-web && git branch --show-current && git rev-parse --short HEAD && git status --short'
curl -fsS http://192.168.88.9:3001/api/health
```

Expected:
- deploy clone 干净
- 健康检查返回 `healthy`

