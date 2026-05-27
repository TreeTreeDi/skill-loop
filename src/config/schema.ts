/**
 * Default configuration schema and known tool mappings
 */

import type { HubConfig, Tool, SyncMode } from '../types.js';

export const DEFAULT_VERSION = '1';

export const KNOWN_TOOLS: Omit<Tool, 'enabled'>[] = [
  { name: 'claude', skillsDir: '~/.claude/skills', mode: 'symlink' as SyncMode },
  { name: 'codex', skillsDir: '~/.codex/skills', mode: 'symlink' as SyncMode },
  { name: 'cursor', skillsDir: '~/.cursor/skills', mode: 'copy' as SyncMode },
  { name: 'continue', skillsDir: '~/.continue/skills', mode: 'symlink' as SyncMode },
  { name: 'gemini', skillsDir: '~/.gemini/skills', mode: 'symlink' as SyncMode },
  { name: 'windsurf', skillsDir: '~/.windsurf/skills', mode: 'symlink' as SyncMode },
  { name: 'trae', skillsDir: '~/.trae/skills', mode: 'symlink' as SyncMode },
  { name: 'kimi', skillsDir: '~/.kimi/skills', mode: 'symlink' as SyncMode },
  { name: 'goose', skillsDir: '~/.goose/skills', mode: 'symlink' as SyncMode },
  { name: 'roo', skillsDir: '~/.roo/skills', mode: 'symlink' as SyncMode },
  { name: 'cline', skillsDir: '~/.cline/skills', mode: 'symlink' as SyncMode },
  { name: 'pi', skillsDir: '~/.pi/skills', mode: 'symlink' as SyncMode },
  { name: 'hermes', skillsDir: '~/.hermes/skills', mode: 'symlink' as SyncMode },
  { name: 'junie', skillsDir: '~/.junie/skills', mode: 'symlink' as SyncMode },
  { name: 'mux', skillsDir: '~/.mux/skills', mode: 'symlink' as SyncMode },
  { name: 'qwen', skillsDir: '~/.qwen/skills', mode: 'symlink' as SyncMode },
  { name: 'pochi', skillsDir: '~/.pochi/skills', mode: 'symlink' as SyncMode },
  { name: 'mcpjam', skillsDir: '~/.mcpjam/skills', mode: 'symlink' as SyncMode },
  { name: 'qoder', skillsDir: '~/.qoder/skills', mode: 'symlink' as SyncMode },
  { name: 'neovate', skillsDir: '~/.neovate/skills', mode: 'symlink' as SyncMode },
  { name: 'iflow', skillsDir: '~/.iflow/skills', mode: 'symlink' as SyncMode },
  { name: 'zencoder', skillsDir: '~/.zencoder/skills', mode: 'symlink' as SyncMode },
  { name: 'adal', skillsDir: '~/.adal/skills', mode: 'symlink' as SyncMode },
  { name: 'kilocode', skillsDir: '~/.kilocode/skills', mode: 'symlink' as SyncMode },
  { name: 'kode', skillsDir: '~/.kode/skills', mode: 'symlink' as SyncMode },
  { name: 'openclaw', skillsDir: '~/.openclaw/skills', mode: 'symlink' as SyncMode },
  { name: 'omx', skillsDir: '~/.omx/skills', mode: 'symlink' as SyncMode },
  { name: 'commandcode', skillsDir: '~/.commandcode/skills', mode: 'symlink' as SyncMode },
  { name: 'vibe', skillsDir: '~/.vibe/skills', mode: 'symlink' as SyncMode },
  { name: 'factory', skillsDir: '~/.factory/skills', mode: 'symlink' as SyncMode },
  { name: 'kiro', skillsDir: '~/.kiro/skills', mode: 'symlink' as SyncMode },
  { name: 'cc-switch', skillsDir: '~/.cc-switch/skills', mode: 'symlink' as SyncMode },
  { name: 'crush', skillsDir: '~/.crush/skills', mode: 'symlink' as SyncMode },
  { name: 'openhands', skillsDir: '~/.openhands/skills', mode: 'symlink' as SyncMode },
  { name: 'augment', skillsDir: '~/.augment/skills', mode: 'symlink' as SyncMode },
  { name: 'agents', skillsDir: '~/.agents/skills', mode: 'symlink' as SyncMode },
  { name: 'copilot', skillsDir: '~/.copilot/skills', mode: 'symlink' as SyncMode },
];

export function getDefaultConfig(): HubConfig {
  return {
    version: DEFAULT_VERSION,
    hub: {
      path: '~/skills-hub',
      autoCommit: true,
    },
    sync: {
      defaultMode: 'symlink',
      prune: false,
    },
    tools: KNOWN_TOOLS.map((t) => ({ ...t, enabled: true })),
  };
}
