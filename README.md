

<div align="center">

# skill-loop

**Sync AI agent skills across multiple tools.**

在多个 AI 助手工具之间自动同步技能（Skills）。

[![npm version](https://img.shields.io/npm/v/skill-loop)](https://www.npmjs.com/package/skill-loop)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

**Languages / 语言**
- [English](#english)
- [中文说明](#中文说明)

---

<a name="english"></a>
## English

### Problem

You have 40+ AI coding assistants installed, each with its own skills directory:

| Tool | Default Skills Directory |
|------|-------------------------|
| Claude Code | `~/.claude/skills/` |
| Codex | `~/.codex/skills/` |
| Cursor | `~/.cursor/skills/` |
| Gemini | `~/.gemini/skills/` |

When you create or update a skill, you have to manually copy it to every tool. That's tedious and error-prone.

### Solution

**skill-loop** uses a **hub-and-spoke** model with **symlinks** as the default sync mechanism.

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

### Installation

```bash
npm install -g skill-loop
# or
pnpm add -g skill-loop
```

### Quick Start

```bash
# 1. Initialize your skills hub
skill-loop init

# 2. Add a new skill
skill-loop add ./my-skill

# 3. Check sync status
skill-loop status

# 4. Sync all tools
skill-loop sync

# 5. add all skills in claude and sync to all agent
skill-loop onboard claude
```

### Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize `~/skills-hub` and import existing skills |
| `add <path>` | Add a skill to hub and sync to tools |
| `remove <skill>` | Remove a skill from hub and all tools |
| `list` | List all skills in hub (press ESC to exit/back) |
| `status` | Show sync status across all tools |
| `sync` | Full sync (repair broken symlinks, add missing) |
| `onboard [tool] [skill]` | Adopt local skills into the hub as global skills, and automatically trigger `sync` to distribute them to all enabled tools. |

#### Smart Arguments for `onboard`

| Pattern | Behavior |
|---------|----------|
| `skill-loop onboard` | Scan all enabled tools for new skills |
| `skill-loop onboard claude` | Adopt all skills from Claude Code |
| `skill-loop onboard my-skill` | Scan all tools for `my-skill` (if not a tool name) |
| `skill-loop onboard claude my-skill` | Adopt a specific skill from a specific tool |

#### Safe Pruning

Run `skill-loop sync --prune` to find and delete local skills that are not in the hub. It will show a list of candidates and ask for confirmation before deleting.

### Sync Modes

| Mode | Mechanism | Best For |
|------|-----------|----------|
| **symlink** (default) | Symbolic links | Tools that support symlinks; zero-latency sync |
| **copy** | File copy | Tools without symlink support (e.g., older Cursor) |

Configure per-tool in `.skills-sync.toml`:

```toml
[[tools]]
name = "cursor"
skillsDir = "~/.cursor/skills"
mode = "copy"
```

### Configuration

Hub-level `.skills-sync.toml` example:

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

### Development

```bash
pnpm install
pnpm test
pnpm build
pnpm lint
```

### Architecture

```
src/
├── cli.ts              # CLI entry (Commander)
├── types.ts            # Core TypeScript definitions
├── commands/           # Sub-command implementations
│   ├── init.ts
│   ├── add.ts
│   ├── remove.ts
│   ├── list.ts
│   ├── status.ts
│   ├── sync.ts
│   └── onboard.ts
├── config/           # Configuration management
│   ├── loader.ts
│   └── schema.ts
├── sync/             # Sync engine core
│   ├── operations.ts # Low-level FS ops (symlink/copy/delete)
│   └── status.ts     # Status evaluator
├── utils/
│   └── skill-meta.ts # SKILL.md parser
└── discovery.ts      # Agent tool auto-discovery
```

---

<a name="中文说明"></a>
## 中文说明

### 问题

您可能安装了 40 多个 AI 编程助手，每个助手都有自己的技能目录：

| 工具 | 默认技能目录 |
|------|-------------|
| Claude Code | `~/.claude/skills/` |
| Codex | `~/.codex/skills/` |
| Cursor | `~/.cursor/skills/` |
| Gemini | `~/.gemini/skills/` |

当您创建或更新某项技能时，必须手动将它复制到每一个助手中。这不仅繁琐，而且容易出错。

### 解决方案

**skill-loop** 采用 **星型拓扑（Hub-Spoke）** 模型，默认以 **符号链接（Symlinks）** 作为同步机制：

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

### 安装

```bash
npm install -g skill-loop
# 或者
pnpm add -g skill-loop
```

### 快速上手

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

### 常用命令

| 命令 | 描述 |
|---------|-------------|
| `init` | 初始化 `~/skills-hub` 技能仓库并自动导入已有技能 |
| `add <path>` | 往 Hub 中添加一个技能并同步到各个 Agent 工具 |
| `remove <skill>` | 从 Hub 及所有 Agent 工具中物理移除某项技能 |
| `list` | 交互式浏览 Hub 中的所有技能（按 ESC 可返回/退出） |
| `status` | 展现所有 Agent 工具目录下的技能同步状态 |
| `sync` | 全量同步状态（补齐缺失的软链/拷贝，修复损坏链接） |
| `onboard [tool] [skill]` | 将 Agent 本地开发的物理技能收录进 Hub（默认作为全局技能），并**自动联动触发 `sync`** 分发至所有已启用工具。 |

#### `onboard` 命令的智能参数

| 用法 | 行为 |
|------|------|
| `skill-loop onboard` | 自动扫描所有已启用工具目录下的全部本地技能 |
| `skill-loop onboard claude` | 只收录 Claude Code 里的本地技能 |
| `skill-loop onboard my-skill` | 若 `my-skill` 不是工具名，则在所有工具目录下搜索并收录 |
| `skill-loop onboard claude my-skill` | 精准收录：指定工具 + 指定技能 |

#### 安全裁剪 (Prune)

运行 `skill-loop sync --prune` 可以查找并交互式删除本地那些**未被 Hub 托管**的多余技能。它会展示候选列表，并在用户输入 `y` 确认后才进行安全清除。

### 同步模式

| 模式 | 机制 | 适用场景 |
|------|------|---------|
| **symlink**（默认） | 符号链接 | 支持 symlink 的工具，零延迟同步 |
| **copy** | 文件拷贝 | 不支持符号链接的环境（如旧版 Cursor） |

可在 `.skills-sync.toml` 中为不同工具分别配置：

```toml
[[tools]]
name = "cursor"
skillsDir = "~/.cursor/skills"
mode = "copy"  # 拷贝模式
```

### 配置

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

### 内部开发

```bash
pnpm install
pnpm test
pnpm build
pnpm lint
```

### 项目结构

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

---

## License

MIT
