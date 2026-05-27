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
  fs.mkdirSync(path.join(hubPath, 'tools'), { recursive: true });

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

  // Phase 1: Classify all skills as global or tool-specific
  const globalSkills = new Map<string, string>(); // skillName -> firstToolPath
  const toolSpecificSkills = new Map<string, Map<string, string>>(); // toolName -> skillName -> toolPath

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

      // Check if this skill exists in any other tool
      const inOtherTool = discovered.some((t) => {
        if (t.name === tool.name) return false;
        const otherPath = expandPath(t.skillsDir, homeDir);
        return fs.existsSync(path.join(otherPath, skillName));
      });

      if (inOtherTool) {
        if (!globalSkills.has(skillName)) {
          globalSkills.set(skillName, path.join(toolPath, skillName));
        }
      } else {
        if (!toolSpecificSkills.has(tool.name)) {
          toolSpecificSkills.set(tool.name, new Map());
        }
        toolSpecificSkills.get(tool.name)!.set(skillName, path.join(toolPath, skillName));
      }
    }
  }

  // Interactive selection (default unless --yes)
  if (!options.yes) {
    if (globalSkills.size > 0) {
      const globalChoices = Array.from(globalSkills.entries()).map(([name, sourcePath]) => {
        const toolName = discovered.find((t) => sourcePath.startsWith(expandPath(t.skillsDir, homeDir)))?.name ?? 'unknown';
        return { name: `${name}  (${toolName})`, value: name, checked: true };
      });

      const { selectedGlobals } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selectedGlobals',
          message: `Select global skills (${globalSkills.size} found, synced to all tools):`,
          choices: globalChoices,
        },
      ]);

      for (const name of globalSkills.keys()) {
        if (!selectedGlobals.includes(name)) {
          globalSkills.delete(name);
        }
      }
    }

    if (toolSpecificSkills.size > 0) {
      const toolChoices: inquirer.ChoiceOptions[] = [];
      for (const [toolName, skills] of toolSpecificSkills) {
        for (const [skillName] of skills) {
          toolChoices.push({
            name: `${toolName}/${skillName}`,
            value: `${toolName}:${skillName}`,
            checked: true,
          });
        }
      }

      if (toolChoices.length > 0) {
        const { selectedTools } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selectedTools',
            message: `Select tool-specific skills (${toolChoices.length} found):`,
            choices: toolChoices,
          },
        ]);

        for (const [toolName, skills] of toolSpecificSkills) {
          for (const skillName of skills.keys()) {
            if (!selectedTools.includes(`${toolName}:${skillName}`)) {
              skills.delete(skillName);
            }
          }
          if (skills.size === 0) {
            toolSpecificSkills.delete(toolName);
          }
        }
      }
    }
  }

  // Phase 2: Import global skills to hub and create symlinks for all tools
  for (const [skillName, sourcePath] of globalSkills) {
    const hubSkillPath = path.join(hubPath, 'skills', skillName);
    if (!fs.existsSync(hubSkillPath)) {
      copySkill(sourcePath, hubSkillPath);
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

  // Phase 3: Import tool-specific skills to hub and create symlinks
  for (const [toolName, skills] of toolSpecificSkills) {
    for (const [skillName, sourcePath] of skills) {
      const hubToolPath = path.join(hubPath, 'tools', toolName, skillName);
      fs.mkdirSync(path.dirname(hubToolPath), { recursive: true });
      if (!fs.existsSync(hubToolPath)) {
        copySkill(sourcePath, hubToolPath);
      }

      const tool = discovered.find((t) => t.name === toolName);
      if (tool) {
        const toolPath = expandPath(tool.skillsDir, homeDir);
        const toolSkillPath = path.join(toolPath, skillName);
        if (fs.existsSync(toolSkillPath)) {
          const stat = fs.lstatSync(toolSkillPath);
          if (!stat.isSymbolicLink()) {
            fs.rmSync(toolSkillPath, { recursive: true });
            createSymlink(toolSkillPath, hubToolPath);
          }
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
  console.log(`  Imported ${globalSkills.size} global skills`);
  let toolSpecificCount = 0;
  for (const [, skills] of toolSpecificSkills) {
    toolSpecificCount += skills.size;
  }
  console.log(`  Imported ${toolSpecificCount} tool-specific skills`);
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
