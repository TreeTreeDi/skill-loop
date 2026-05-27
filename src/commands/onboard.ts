/**
 * Onboard command - adopt skills from tool directories into hub
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { loadConfig, saveConfig, expandPath } from '../config/loader.js';
import { createSymlink } from '../sync/operations.js';
import { readSkillMeta } from '../utils/skill-meta.js';
import { syncCommand } from './sync.js';

export interface OnboardOptions {
  hubPath: string;
  toolName?: string;
  skillName?: string;
  scope?: 'global' | 'tool-specific';
  homeDir?: string;
}

export async function onboardCommand(options: OnboardOptions): Promise<void> {
  const homeDir = options.homeDir ?? os.homedir();
  const configPath = path.join(options.hubPath, '.skills-sync.toml');
  const config = loadConfig(configPath);
  const hubPath = expandPath(config.hub.path, homeDir);

  let toolName = options.toolName;
  let skillName = options.skillName;

  if (toolName) {
    const isTool = config.tools.some((t) => t.name === toolName);
    if (!isTool) {
      // If the first argument is not a valid tool, treat it as the skill name
      skillName = toolName;
      toolName = undefined;
    }
  }

  const tools = toolName
    ? config.tools.filter((t) => t.name === toolName)
    : config.tools.filter((t) => t.enabled);

  if (toolName && tools.length === 0) {
    throw new Error(`Unknown or disabled tool: ${toolName}`);
  }

  const onboarded: string[] = [];

  for (const tool of tools) {
    const toolSkillsDir = expandPath(tool.skillsDir, homeDir);
    if (!fs.existsSync(toolSkillsDir)) continue;

    const entries = fs.readdirSync(toolSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    const skillsToOnboard = skillName
      ? entries.filter((e) => e === skillName)
      : entries;

    for (const sName of skillsToOnboard) {
      const sourcePath = path.join(toolSkillsDir, sName);
      const stat = fs.lstatSync(sourcePath);

      // Skip if already a symlink
      if (stat.isSymbolicLink()) {
        continue;
      }

      // Determine scope
      const isGlobal = options.scope === 'global';

      // Check if hub already has this skill
      const hubGlobalPath = path.join(hubPath, 'skills', sName);
      const hubToolPath = path.join(hubPath, 'tools', tool.name, sName);

      const isDirEmpty = (dirPath: string) => {
        try {
          return fs.readdirSync(dirPath).length === 0;
        } catch {
          return false;
        }
      };

      if (fs.existsSync(hubGlobalPath)) {
        if (isDirEmpty(hubGlobalPath)) {
          fs.rmdirSync(hubGlobalPath);
        } else {
          continue;
        }
      }

      if (fs.existsSync(hubToolPath)) {
        if (isDirEmpty(hubToolPath)) {
          fs.rmdirSync(hubToolPath);
        } else {
          continue;
        }
      }

      // Move to hub
      if (isGlobal) {
        fs.mkdirSync(path.dirname(hubGlobalPath), { recursive: true });
        fs.renameSync(sourcePath, hubGlobalPath);
        createSymlink(sourcePath, hubGlobalPath);
      } else {
        fs.mkdirSync(path.dirname(hubToolPath), { recursive: true });
        fs.renameSync(sourcePath, hubToolPath);
        createSymlink(sourcePath, hubToolPath);
      }

      onboarded.push(`${tool.name}/${sName}`);
    }
  }

  if (onboarded.length > 0 && config.hub.autoCommit) {
    try {
      execSync('git add -A', { cwd: hubPath, stdio: 'ignore' });
      execSync(`git commit -m "chore: onboard ${onboarded.length} skills from tools"`, { cwd: hubPath, stdio: 'ignore' });
    } catch {
      // Ignore
    }
  }

  console.log(`✓ Onboarded ${onboarded.length} skills`);

  if (onboarded.length > 0) {
    console.log('Auto-syncing to all agents...');
    await syncCommand({ hubPath: options.hubPath, homeDir: options.homeDir });
  }
}
