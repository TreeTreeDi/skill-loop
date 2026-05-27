/**
 * Init command - initialize skills hub
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import inquirer from 'inquirer';
import { loadConfig, saveConfig, expandPath } from '../config/loader.js';
import { getDefaultConfig } from '../config/schema.js';
import { discoverTools } from '../discovery.js';
import { createSymlink } from '../sync/operations.js';
import type { HubConfig } from '../types.js';

export interface InitOptions {
  hubPath?: string;
  yes?: boolean;
  append?: boolean;
  homeDir?: string;
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const homeDir = options.homeDir ?? os.homedir();
  const hubPath = options.hubPath ? expandPath(options.hubPath, homeDir) : path.join(homeDir, 'skills-hub');
  const configPath = path.join(hubPath, '.skills-sync.toml');

  // Check if hub already exists
  if (fs.existsSync(hubPath) && !options.append) {
    throw new Error(`Hub already exists at ${hubPath}. Use --append to add more tools.`);
  }

  // Create hub directory structure
  fs.mkdirSync(path.join(hubPath, 'skills'), { recursive: true });

  // Discover existing tools
  const discovered = discoverTools(homeDir).filter((t) => t.exists);

  // Load existing config or create default
  let config: HubConfig;
  if (options.append && fs.existsSync(configPath)) {
    config = loadConfig(configPath);
  } else {
    config = getDefaultConfig();
    config.hub.path = options.hubPath ?? config.hub.path;
  }

  // Phase 1: Discover all skills and treat them all as global skill candidates
  const globalSkills = new Map<string, { sourcePath: string; toolNames: string[] }>();

  for (const tool of discovered) {
    const toolPath = expandPath(tool.skillsDir, homeDir);
    if (!fs.existsSync(toolPath)) continue;

    const entries = fs.readdirSync(toolPath, { withFileTypes: true })
      .filter((e) => {
        // Skip hidden directories (e.g. .archive, .git)
        if (e.name.startsWith('.')) return false;
        if (e.isDirectory()) return true;
        if (e.isSymbolicLink()) {
          // Skip broken symlinks — they are not valid skills
          return fs.existsSync(path.join(toolPath, e.name));
        }
        return false;
      });

    for (const entry of entries) {
      const skillName = entry.name;
      const fullPath = path.join(toolPath, skillName);

      const existing = globalSkills.get(skillName);
      if (existing) {
        if (!existing.toolNames.includes(tool.name)) {
          existing.toolNames.push(tool.name);
        }
      } else {
        globalSkills.set(skillName, {
          sourcePath: fullPath,
          toolNames: [tool.name],
        });
      }
    }
  }

  // Interactive selection (default unless --yes)
  const selectedSkills = new Set<string>();
  if (!options.yes) {
    if (globalSkills.size > 0) {
      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message: 'Select skills to import into Hub (these will be moved to Hub and symlinked back):',
          choices: Array.from(globalSkills.entries()).map(([name, info]) => {
            const toolsStr = info.toolNames.join(', ');
            return { name: `${name}  (${toolsStr})`, value: name, checked: true };
          }),
        },
      ]);
      for (const name of selected) {
        selectedSkills.add(name);
      }
    }
  } else {
    for (const name of globalSkills.keys()) {
      selectedSkills.add(name);
    }
  }

  // Phase 2: Import selected skills to hub and create symlinks for all tools
  for (const skillName of selectedSkills) {
    const info = globalSkills.get(skillName);
    if (!info) continue;

    const hubSkillPath = path.join(hubPath, 'skills', skillName);
    if (!fs.existsSync(hubSkillPath)) {
      copySkill(info.sourcePath, hubSkillPath);
    }

    // Create symlinks in all tools that have this skill
    for (const tool of discovered) {
      const toolPath = expandPath(tool.skillsDir, homeDir);
      const toolSkillPath = path.join(toolPath, skillName);
      if (fs.existsSync(toolSkillPath)) {
        const stat = fs.lstatSync(toolSkillPath);
        if (!stat.isSymbolicLink()) {
          fs.rmSync(toolSkillPath, { recursive: true });
          createSymlink(toolSkillPath, hubSkillPath);
        }
      }
    }
  }

  // Update config with discovered tools
  for (const tool of discovered) {
    const existing = config.tools.find((t) => t.name === tool.name);
    if (!existing) {
      config.tools.push({
        name: tool.name,
        skillsDir: tool.skillsDir,
        enabled: true,
        mode: 'symlink',
      });
    }
  }

  // Save config
  saveConfig(configPath, config);

  // Initialize git if not already
  const gitDir = path.join(hubPath, '.git');
  if (!fs.existsSync(gitDir)) {
    execSync('git init', { cwd: hubPath, stdio: 'ignore' });
  }

  // Initial commit
  if (config.hub.autoCommit) {
    try {
      execSync('git add -A', { cwd: hubPath, stdio: 'ignore' });
      const status = execSync('git status --porcelain', { cwd: hubPath, encoding: 'utf-8' });
      if (status.trim()) {
        execSync('git commit -m "chore: initialize skills hub"', { cwd: hubPath, stdio: 'ignore' });
      }
    } catch {
      // Git commit failed, ignore
    }
  }

  console.log(`✓ Skills hub initialized at ${hubPath}`);
  console.log(`  Imported ${selectedSkills.size} skills`);
  console.log(`  Registered ${discovered.length} tools`);
}

function copySkill(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });

  function copyRecursive(source: string, dest: string): void {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(source);
    } catch {
      return; // Broken symlink or missing path, skip silently
    }

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
