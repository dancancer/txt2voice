# UI/UX Pro Max 在 txt2voice 的落地说明

## 已完成事项

- 已阅读并验证仓库：`https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`
- 已安装到当前项目：`.codex/skills/ui-ux-pro-max`
- 已完成项目化适配：
  - 将 skill 内示例命令路径统一为项目内可执行路径：`.codex/skills/ui-ux-pro-max/scripts/search.py`
  - 将默认技术栈从 `html-tailwind` 调整为 `nextjs`
  - 增加 txt2voice 专用路由映射与推荐命令

## 项目内关键路径

- Skill 文档：`.codex/skills/ui-ux-pro-max/SKILL.md`
- 搜索脚本：`.codex/skills/ui-ux-pro-max/scripts/search.py`
- 规则数据：`.codex/skills/ui-ux-pro-max/data/*.csv`

## 推荐工作流（txt2voice）

### 1) 生成项目级 Design System（Master）

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "audio book platform dashboard" --design-system --persist -p "txt2voice" --stack nextjs --output-dir docs/technical/ui-ux
```

### 2) 生成页面级覆盖规则（Overrides）

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "book detail editing queue progress" --design-system --persist -p "txt2voice" --stack nextjs --page "book-detail" --output-dir docs/technical/ui-ux
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "characters mapping voice assignment table" --design-system --persist -p "txt2voice" --stack nextjs --page "characters" --output-dir docs/technical/ui-ux
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "audio generation playback quality progress" --design-system --persist -p "txt2voice" --stack nextjs --page "audio" --output-dir docs/technical/ui-ux
```

### 3) 针对问题域做补充检索

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "audio player accessibility keyboard focus contrast" --domain ux
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "dashboard dense information hierarchy" --domain style
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "nextjs route loading skeleton empty error state" --stack nextjs
```

## 当前项目路由映射（用于 prompt）

- `/` 书籍列表 + 上传入口
- `/books/[id]` 书籍详情工作区
- `/books/[id]/characters` 角色档案 + 配音绑定
- `/books/[id]/script` 台本与句子校验
- `/books/[id]/audio` 音频生成进度与下载
- `/books/[id]/play` 播放页
- `/voices` 与 `/tts/speakers` 声音库管理

## 注意事项

- 该 skill 的数据集偏通用产品设计，建议将输出作为“设计候选”，再结合业务约束（长任务、进度可视化、失败重试、可回放）进行二次裁剪。
- 若后续需要更强适配，可扩展一个 `txt2voice-ui` 本地 skill，对常见页面固定查询词与校验清单。
