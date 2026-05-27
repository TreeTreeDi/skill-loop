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

export interface OnboardOptions {
  hubPath: string;
  toolName: string;
  skillName?: string;
  scope?: 'global' | 'tool-specific';
  homeDir?: string;
}

export async function onboardCommand(options: OnboardOptions): Promise<void> {
  const homeDir = options.homeDir ?? os.homedir();
  const configPath = path.join(options.hubPath, '.skills-sync.toml');
  const config = loadConfig(configPath);
  const hubPath = expandPath(config.hub.path, homeDir);

  const tool = config.tools.find((t) => t.name === options.toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${options.toolName}`);
  }

  const toolSkillsDir = expandPath(tool.skillsDir, homeDir);
  if (!fs.existsSync(toolSkillsDir)) {
    throw new Error(`Tool skills directory does not exist: ${toolSkillsDir}`);
  }

  const entries = fs.readdirSync(toolSkillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const skillsToOnboard = options.skillName
    ? entries.filter((e) => e === options.skillName)
    : entries;

  if (skillsToOnboard.length === 0) {
    console.log('No skills to onboard.');
    return;
  }

  const onboarded: string[] = [];

  for (const skillName of skillsToOnboard) {
    const sourcePath = path.join(toolSkillsDir, skillName);
    const stat = fs.lstatSync(sourcePath);

    // Skip if already a symlink
    if (stat.isSymbolicLink()) {
      console.log(`  Skip ${skillName}: already managed by hub`);
      continue;
    }

    // Determine scope
    const isGlobal = options.scope === 'global';

    // Check if hub already has this skill
    const hubGlobalPath = path.join(hubPath, 'skills', skillName);
    const hubToolPath = path.join(hubPath, 'tools', tool.name, skillName);

    if (fs.existsSync(hubGlobalPath) || fs.existsSync(hubToolPath)) {
      console.log(`  Skip ${skillName}: already exists in hub`);
      continue;
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

    onboarded.push(skillName);
  }

  if (onboarded.length > 0 && config.hub.autoCommit) {
    try {
      execSync('git add -A', { cwd: hubPath, stdio: 'ignore' });
      execSync(`git commit -m "chore: onboard ${onboarded.length} skills from ${tool.name}"`, { cwd: hubPath, stdio: 'ignore' });
    } catch {
      // Ignore
    }
  }

  console.log(`✓ Onboarded ${onboarded.length} skills from ${tool.name}`);
}
