# skill-loop

Sync AI agent skills across multiple tools (Claude Code, Codex, Cursor, Gemini, and 30+ more).

在多个 AI 助手工具（Claude Code、Codex、Cursor、Gemini 等 30 多个工具）之间自动同步技能（Skills）。

---

* [English](#english)
* [中文说明](#中文说明)

---

## English

## Problem

You have 40+ AI coding assistants installed, each with its own skills directory:
- `~/.claude/skills/`
- `~/.codex/skills/`
- `~/.cursor/skills/`
- `~/.gemini/skills/`
- ...

When you create or update a skill, you have to manually copy it to every tool. That's tedious and error-prone.

## Solution

**skill-loop** uses a hub-and-spoke model with **symlinks** as the default sync mechanism:

```
~/skills-hub/              ← Git repo, single source of truth
├── skills/                ← Global skills (synced to all tools)
│   ├── check/
│   ├── design/
│   └── ...
└── tools/
    ├── gemini/
    │   └── lark-approval/   ← Tool-specific skills
    └── ...

~/.claude/skills/check@  → symlink → ~/skills-hub/skills/check
~/.gemini/skills/check@  → symlink → ~/skills-hub/skills/check
```

Edit once in the hub, changes instantly reflect in all tools.

## Installation

```bash
npm install -g skill-loop
# or
pnpm add -g skill-loop
```

## Quick Start

```bash
# 1. Initialize your skills hub
skill-loop init

# 2. Add a new skill
skill-loop add ./my-skill

# 3. Check sync status
skill-loop status

# 4. Sync all tools
skill-loop sync
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize `~/skills-hub` and import existing skills |
| `add <path>` | Add a skill to hub and sync to tools |
| `remove <skill>` | Remove a skill from hub and all tools |
| `list` | List all skills in hub (press ESC to exit/back) |
| `status` | Show sync status across all tools |
| `sync` | Full sync (repair broken symlinks, add missing) |
| `onboard [tool] [skill]` | Adopt local skills into the hub as global skills, and automatically trigger `sync` to distribute them to all enabled tools. |

### Smart Arguments for `onboard`:
- **All tools**: `skill-loop onboard` will scan all enabled tools for new skills.
- **Specific tool**: `skill-loop onboard claude` will adopt all skills from Claude Code.
- **Specific skill**: `skill-loop onboard my-skill` (if `my-skill` is not a tool name) will scan all tools for `my-skill`.
- **Specific tool and skill**: `skill-loop onboard claude my-skill`.

### Safe Pruning:
Run `skill-loop sync --prune` to find and delete local skills that are not in the hub. It will show a list of candidates and ask for confirmation before deleting.

---

## 中文说明

## 问题

您可能安装了 40 多个 AI 编程助手，每个助手都有自己的技能目录：
- `~/.claude/skills/`
- `~/.codex/skills/`
- `~/.cursor/skills/`
- `~/.gemini/skills/`
- ...

当您创建或更新某项技能时，必须手动将它复制到每一个助手中。这不仅繁琐，而且容易出错。

## 解决方案

**skill-loop** 采用星型拓扑模型，默认以 **符号链接（Symlinks）** 作为同步机制：

```
~/skills-hub/              ← Git 仓库，唯一事实源
├── skills/                ← 全局技能（同步分发到所有工具中）
│   ├── check/
│   ├── design/
│   └── ...
└── tools/
    ├── gemini/
    │   └── lark-approval/   ← 某个工具专属的技能
    └── ...

~/.claude/skills/check@  → 软链接 → ~/skills-hub/skills/check
~/.gemini/skills/check@  → 软链接 → ~/skills-hub/skills/check
```

只需在 Hub 仓库中修改一次，所有工具的技能均会实时同步生效。

## 安装

```bash
npm install -g skill-loop
# 或者
pnpm add -g skill-loop
```

## 快速上手

```bash
# 1. 初始化您的技能仓库 (Hub)
skill-loop init

# 2. 录入一项新技能
skill-loop add ./my-skill

# 3. 检查各 Agent 工具的同步状态
skill-loop status

# 4. 同步分发到所有工具
skill-loop sync
```

## 常用命令

| 命令 | 描述 |
|---------|-------------|
| `init` | 初始化 `~/skills-hub` 技能仓库并自动导入已有技能 |
| `add <path>` | 往 Hub 中添加一个技能并同步到各个 Agent 工具 |
| `remove <skill>` | 从 Hub 及所有 Agent 工具中物理移除某项技能 |
| `list` | 交互式浏览 Hub 中的所有技能（按 ESC 可返回/退出） |
| `status` | 展现所有 Agent 工具目录下的技能同步状态 |
| `sync` | 全量同步状态（补齐缺失的软链/拷贝，修复损坏链接） |
| `onboard [tool] [skill]` | 将 Agent 本地开发的物理技能收录进 Hub（默认作为全局技能），并**自动联动触发 `sync`** 分发至所有已启用工具。 |

### `onboard` 命令的智能参数：
- **全部收录**：运行 `skill-loop onboard` 会自动扫描所有已启用工具目录下的全部本地技能。
- **指定工具**：运行 `skill-loop onboard claude` 只收录 Claude Code 里的本地技能。
- **指定技能（跨工具搜索）**：运行 `skill-loop onboard my-skill`（若 `my-skill` 不是工具名）会在所有工具目录下搜索 `my-skill` 并收录。
- **精准收录**：运行 `skill-loop onboard claude my-skill`。

### 安全裁剪 (Prune)：
运行 `skill-loop sync --prune` 可以查找并交互式删除本地那些未被 Hub 托管的多余技能。它会展示列表，并在用户输入 `y` 确认后才进行安全清除。

---

## Sync Modes / 同步模式

- **symlink** (default/默认): 极速无延迟同步，Hub 拥有真实文件，工具目录只存放其软链。
- **copy**: 文件拷贝同步。适合那些不支持符号链接的工具（如旧版 Cursor）。

可以在 `.skills-sync.toml` 中为不同工具分别配置：

```toml
[[tools]]
name = "cursor"
skillsDir = "~/.cursor/skills"
mode = "copy"  # 拷贝模式
```

---

## Configuration / 配置

Hub 目录下的 `.skills-sync.toml` 配置规范示例：

```toml
version = "1"

[hub]
path = "~/skills-hub"
autoCommit = true

[sync]
defaultMode = "symlink"
prune = false

[[tools]]
name = "claude"
skillsDir = "~/.claude/skills"
enabled = true
```

## Development / 内部开发

```bash
pnpm install
pnpm test
pnpm build
pnpm lint
```

## Architecture / 项目结构

```
src/
├── cli.ts              # 命令行入口 (Commander)
├── types.ts            # TypeScript 核心类型定义
├── commands/           # 具体子命令实现
│   ├── init.ts
│   ├── add.ts
│   ├── remove.ts
│   ├── list.ts
│   ├── status.ts
│   ├── sync.ts
│   └── onboard.ts
├── config/             # 配置管理
│   ├── loader.ts
│   └── schema.ts
├── sync/               # 同步引擎核心
│   ├── operations.ts   # 软链/拷贝/删除底层文件系统操作
│   └── status.ts       # 状态检查评估器
├── utils/
│   └── skill-meta.ts   # SKILL.md 解析
└── discovery.ts        # Agent 工具自动发现引擎
```

## License

MIT
