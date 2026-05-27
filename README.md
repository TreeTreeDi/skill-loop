# skill-loop

Sync AI agent skills across multiple tools (Claude Code, Codex, Cursor, Gemini, and 30+ more).

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
| `list` | List all skills in hub |
| `status` | Show sync status across all tools |
| `sync` | Full sync (repair broken symlinks, add missing) |
| `onboard <tool> [skill]` | Adopt a tool's standalone skill into hub |

## Supported Tools

37 tools detected automatically:

Claude Code, Codex, Cursor, Continue, Gemini, Windsurf, Trae, Kimi, Goose, Roo, Cline, Pi, Hermes, Junie, Mux, Qwen, Pochi, MCPJam, Qoder, Neovate, iFlow, Zencoder, Adal, Kilocode, Kode, OpenClaw, OMX, CommandCode, Vibe, Factory, Kiro, CC-Switch, Crush, OpenHands, Augment, Agents, Copilot

## Sync Modes

- **symlink** (default): Hub is the single file; tools reference it. Zero-delay sync.
- **copy**: Independent copies per tool. Use for tools that don't support symlinks.

Configure per tool in `.skill-loop.toml`:

```toml
[[tools]]
name = "cursor"
skills_dir = "~/.cursor/skills"
mode = "copy"  # cursor doesn't support symlinks
```

## Configuration

`.skill-loop.toml` in your hub directory:

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
```

## Development

```bash
pnpm install
pnpm test
pnpm build
pnpm lint
```

## Architecture

```
src/
├── cli.ts              # CLI entry (Commander)
├── types.ts            # Core TypeScript types
├── commands/           # CLI commands
│   ├── init.ts
│   ├── add.ts
│   ├── remove.ts
│   ├── list.ts
│   ├── status.ts
│   ├── sync.ts
│   └── onboard.ts
├── config/             # Config parsing
│   ├── loader.ts
│   └── schema.ts
├── sync/               # Sync engine
│   ├── operations.ts   # Symlink/copy ops
│   └── status.ts       # State checking
├── utils/
│   └── skill-meta.ts   # SKILL.md parsing
└── discovery.ts        # Tool discovery
```

## License

MIT
