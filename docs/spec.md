# skills-sync 设计文档

## 概述

`skills-sync` 是一个 CLI 工具，用于在多个 AI 编程助手工具（Claude Code、Codex、Cursor、Gemini 等）之间同步和管理 reusable skills（agent instructions）。

核心机制：**Symlink 优先**，hub 作为唯一 source of truth。

## 问题

用户拥有 40+ 个 AI 工具（`~/.claude`, `~/.codex`, `~/.cursor`, `~/.gemini` 等），skills 分散在各工具的独立目录中：
- 新增一个 skill 需要手动复制到 N 个目录
- 修改一个 skill 需要手动更新 N 个副本
- 无法版本控制，改错的 skill 无法回滚

## 方案

### 架构

```
~/skills-hub/              ← Git 仓库，唯一可编辑
├── skills/                ← 通用 skills（同步到所有工具）
│   ├── check/
│   ├── design/
│   └── ...
├── tools/                 ← 工具特有 skills
│   ├── gemini/
│   │   └── lark-approval/
│   └── cursor/
│       └── cursor-only/
└── .skills-sync.toml      ← 配置

~/.claude/skills/check@  → symlink → ~/skills-hub/skills/check
~/.gemini/skills/check@  → symlink → ~/skills-hub/skills/check
```

### CLI 命令

| 命令 | 说明 |
|------|------|
| `init` | 初始化 hub，自动发现并导入现有 skills |
| `add <path>` | 添加新 skill 到 hub 并同步 |
| `remove <skill>` | 从 hub 移除，同步删除 |
| `list` | 列出 hub 中所有 skills |
| `status` | 查看各工具同步状态 |
| `sync` | 全量同步（修复断裂 symlink、新增工具） |
| `onboard <tool> [skill]` | 将工具目录中的独立 skill 移入 hub |

### 配置 (.skills-sync.toml)

```toml
version = "1"

[hub]
path = "~/skills-hub"
auto_commit = true

[sync]
default_mode = "symlink"
prune = false

[[tools]]
name = "claude"
skills_dir = "~/.claude/skills"
enabled = true

[[tools]]
name = "cursor"
skills_dir = "~/.cursor/skills"
enabled = true
mode = "copy"  # cursor 不支持 symlink
```

## 技术栈

- **Node.js + TypeScript**
- **包管理**: pnpm
- **CLI 框架**: Commander.js + Inquirer.js（交互式）
- **测试**: Vitest（单元测试全覆盖）
- **构建**: tsup
- **代码质量**: ESLint + Prettier + TypeScript strict

## 同步策略

1. **默认 symlink**: hub 修改即时生效在所有工具
2. **Copy 降级**: 工具不支持 symlink 时，用 copy 模式
3. **冲突检测**: 工具目录中的独立副本 vs hub 版本 → `status` 标记，`onboard` 处理
4. **删除策略**: 默认保守（不 prune），可选 `--prune` 同步删除

## 开源标准

- Conventional Commits
- Semantic Versioning
- MIT License
- 完整单元测试 + 集成测试
- GitHub Actions CI/CD
