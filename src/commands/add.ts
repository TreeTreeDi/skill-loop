/**
 * Add command - add a skill to hub and sync to tools
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { loadConfig, saveConfig, expandPath } from '../config/loader.js';
import { createSymlink, createCopy } from '../sync/operations.js';
import { readSkillMeta } from '../utils/skill-meta.js';

export interface AddOptions {
  hubPath: string;
  skillPath: string;
  scope?: 'global' | string[];
  mode?: 'symlink' | 'copy';
  homeDir?: string;
}

export async function addCommand(options: AddOptions): Promise<void> {
  const homeDir = options.homeDir ?? os.homedir();
  const configPath = path.join(options.hubPath, '.skills-sync.toml');
  const config = loadConfig(configPath);
  const hubPath = expandPath(config.hub.path, homeDir);

  const sourcePath = path.resolve(options.skillPath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Skill path does not exist: ${sourcePath}`);
  }

  const meta = readSkillMeta(sourcePath);
  const skillName = meta.name;

  // Determine scope
  const isGlobal = !options.scope || options.scope === 'global';
  const targetTools = isGlobal
    ? config.tools.filter((t) => t.enabled)
    : config.tools.filter((t) => t.enabled && (options.scope as string[]).includes(t.name));

  // Copy to hub
  if (isGlobal) {
    const hubSkillPath = path.join(hubPath, 'skills', skillName);
    copyDir(sourcePath, hubSkillPath);
  } else {
    for (const tool of targetTools) {
      const hubToolPath = path.join(hubPath, 'tools', tool.name, skillName);
      fs.mkdirSync(path.dirname(hubToolPath), { recursive: true });
      copyDir(sourcePath, hubToolPath);
    }
  }

  // Sync to tools
  for (const tool of targetTools) {
    const toolSkillsDir = expandPath(tool.skillsDir, homeDir);
    const toolSkillPath = path.join(toolSkillsDir, skillName);

    if (fs.existsSync(toolSkillPath)) {
      fs.rmSync(toolSkillPath, { recursive: true, force: true });
    }

    const mode = options.mode ?? tool.mode ?? config.sync.defaultMode;
    if (mode === 'symlink') {
      const target = isGlobal
        ? path.join(hubPath, 'skills', skillName)
        : path.join(hubPath, 'tools', tool.name, skillName);
      createSymlink(toolSkillPath, target);
    } else {
      const source = isGlobal
        ? path.join(hubPath, 'skills', skillName)
        : path.join(hubPath, 'tools', tool.name, skillName);
      createCopy(toolSkillPath, source);
    }
  }

  // Git commit
  if (config.hub.autoCommit) {
    try {
      execSync('git add -A', { cwd: hubPath, stdio: 'ignore' });
      execSync(`git commit -m "feat: add skill ${skillName}"`, { cwd: hubPath, stdio: 'ignore' });
    } catch {
      // Ignore
    }
  }

  const scopeText = isGlobal ? 'all tools' : targetTools.map((t) => t.name).join(', ');
  console.log(`✓ Added skill "${skillName}" to ${scopeText}`);
}

function copyDir(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });

  function copyRecursive(source: string, dest: string): void {
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(source);
      for (const entry of entries) {
        copyRecursive(path.join(source, entry), path.join(dest, entry));
      }
    } else {
      fs.copyFileSync(source, dest);
    }
  }

  copyRecursive(src, dst);
}
