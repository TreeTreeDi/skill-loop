<div align="center">

# skill-loop

**Sync AI agent skills across multiple tools.**

[![npm version](https://img.shields.io/npm/v/skill-loop)](https://www.npmjs.com/package/skill-loop)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

**Languages / 语言**
- [English](README.md)
- [中文说明](README.zh-CN.md)

---

## Problem

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
└── skills/                ← Global skills (synced to all tools)

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
# 1. Initialize your skills hub (you can filter which skills to onboard during init)
skill-loop init

# 2. Add a new skill
skill-loop add ./my-skill

# 3. Check sync status
skill-loop status

# 4. Sync all tools
skill-loop sync

# 5. Onboard all skills in claude and sync to all agents
skill-loop onboard claude
```

### Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize `~/skills-hub`, import existing skills with interactive checklists |
| `add <path>` | Add a skill to hub and sync to tools |
| `remove <skill>` | Remove a skill from hub and all tools |
| `list` | List all skills in hub (press ESC to exit/back) |
| `status` | Show sync status across all tools |
| `sync` | Full sync (repair broken symlinks, add missing) |
| `onboard [tool] [skill]` | Adopt local skills into the hub as global skills with interactive checkbox selections, and automatically trigger `sync` to distribute them. |

#### Smart Arguments for `onboard`

| Pattern | Behavior |
|---------|----------|
| `skill-loop onboard` | Scan all enabled tools for new skills and show interactive selection checklist |
| `skill-loop onboard claude` | Adopt skills from Claude Code with interactive selection checklist |
| `skill-loop onboard my-skill` | Scan all tools for `my-skill` and onboard it directly |
| `skill-loop onboard claude my-skill` | Adopt a specific skill from a specific tool directly |

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

## License

MIT
