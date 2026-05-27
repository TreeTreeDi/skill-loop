/**
 * Configuration loader for .skills-sync.toml
 */

export { getDefaultConfig } from './schema.js';

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parse, stringify } from 'smol-toml';
import type { HubConfig, Tool } from '../types.js';
import { getDefaultConfig } from './schema.js';

export function expandPath(p: string, homeDir?: string): string {
  if (p.startsWith('~/')) {
    return path.join(homeDir ?? os.homedir(), p.slice(2));
  }
  return p;
}

export function loadConfig(configPath: string): HubConfig {
  const defaults = getDefaultConfig();

  if (!fs.existsSync(configPath)) {
    return defaults;
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = parse(raw) as Partial<HubConfig> & { tools?: Partial<Tool>[] };

  const merged: HubConfig = {
    version: parsed.version ?? defaults.version,
    hub: {
      path: parsed.hub?.path ?? defaults.hub.path,
      autoCommit: parsed.hub?.autoCommit ?? defaults.hub.autoCommit,
    },
    sync: {
      defaultMode: parsed.sync?.defaultMode ?? defaults.sync.defaultMode,
      prune: parsed.sync?.prune ?? defaults.sync.prune,
    },
    tools: parsed.tools && parsed.tools.length > 0
      ? parsed.tools.map((tool) => {
          const defaultTool = defaults.tools.find((t) => t.name === tool.name);
          return {
            name: tool.name!,
            skillsDir: tool.skillsDir ?? defaultTool?.skillsDir ?? '~/.unknown/skills',
            enabled: tool.enabled ?? defaultTool?.enabled ?? true,
            mode: tool.mode ?? defaultTool?.mode ?? defaults.sync.defaultMode,
          };
        })
      : defaults.tools,
  };

  return merged;
}

export function saveConfig(configPath: string, config: HubConfig): void {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, stringify(config), 'utf-8');
}
