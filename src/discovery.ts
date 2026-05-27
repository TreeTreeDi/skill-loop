/**
 * Tool discovery - scan for existing AI tool skills directories
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { KNOWN_TOOLS } from './config/schema.js';
import type { ToolDiscoveryResult } from './types.js';

export function discoverTools(homeDir?: string): ToolDiscoveryResult[] {
  const home = homeDir ?? os.homedir();

  return KNOWN_TOOLS.map((tool) => {
    const skillsDir = path.join(home, tool.skillsDir.replace(/^~\//, ''));
    const exists = fs.existsSync(skillsDir);

    let skillCount = 0;
    if (exists) {
      try {
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        skillCount = entries.filter((e) => e.isDirectory()).length;
      } catch {
        // Directory exists but is not readable
        skillCount = 0;
      }
    }

    return {
      name: tool.name,
      skillsDir: tool.skillsDir,
      exists,
      skillCount,
      registered: true,
    };
  });
}
