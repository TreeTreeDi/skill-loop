/**
 * Remove command - remove a skill from hub and all tools
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { loadConfig, expandPath } from '../config/loader.js';

export interface RemoveOptions {
  hubPath: string;
  skillName: string;
  homeDir?: string;
}

export async function removeCommand(options: RemoveOptions): Promise<void> {
  const homeDir = options.homeDir ?? os.homedir();
  const configPath = path.join(options.hubPath, '.skills-sync.toml');
  const config = loadConfig(configPath);
  const hubPath = expandPath(config.hub.path, homeDir);

  const skillName = options.skillName;

  // Check if skill exists in hub
  const hubGlobalPath = path.join(hubPath, 'skills', skillName);
  const isGlobal = fs.existsSync(hubGlobalPath);

  let removedFromTools = 0;

  // Remove from all tools
  for (const tool of config.tools) {
    if (!tool.enabled) continue;

    const toolSkillsDir = expandPath(tool.skillsDir, homeDir);
    const toolSkillPath = path.join(toolSkillsDir, skillName);

    if (fs.existsSync(toolSkillPath)) {
      fs.rmSync(toolSkillPath, { recursive: true, force: true });
      removedFromTools++;
    }
  }

  // Remove from hub
  if (isGlobal) {
    fs.rmSync(hubGlobalPath, { recursive: true, force: true });
  }

  // Also check tool-specific directories
  const toolsDir = path.join(hubPath, 'tools');
  if (fs.existsSync(toolsDir)) {
    const toolDirs = fs.readdirSync(toolsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory());

    for (const toolDir of toolDirs) {
      const toolSkillPath = path.join(toolsDir, toolDir.name, skillName);
      if (fs.existsSync(toolSkillPath)) {
        fs.rmSync(toolSkillPath, { recursive: true, force: true });
      }
    }
  }

  // Git commit
  if (config.hub.autoCommit) {
    try {
      execSync('git add -A', { cwd: hubPath, stdio: 'ignore' });
      execSync(`git commit -m "chore: remove skill ${skillName}"`, { cwd: hubPath, stdio: 'ignore' });
    } catch {
      // Ignore
    }
  }

  console.log(`✓ Removed skill "${skillName}" from ${removedFromTools} tools`);
}
