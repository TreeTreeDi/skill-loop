/**
 * Onboard command - adopt skills from tool directories into hub
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { loadConfig, expandPath } from '../config/loader.js';
import { createSymlink } from '../sync/operations.js';
import { syncCommand } from './sync.js';
import inquirer from 'inquirer';
import type { Tool } from '../types.js';

export interface OnboardOptions {
  hubPath: string;
  toolName?: string;
  skillName?: string;
  scope?: 'global' | 'tool-specific';
  homeDir?: string;
  yes?: boolean;
}

interface OnboardCandidate {
  tool: Tool;
  skillName: string;
  sourcePath: string;
  hubGlobalPath: string;
  hubToolPath: string;
  isGlobal: boolean;
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

  const candidates: OnboardCandidate[] = [];

  for (const tool of tools) {
    const toolSkillsDir = expandPath(tool.skillsDir, homeDir);
    if (!fs.existsSync(toolSkillsDir)) continue;

    const entries = fs.readdirSync(toolSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => e.name);

    const skillsToOnboard = skillName
      ? entries.filter((e) => e === skillName)
      : entries;

    for (const sName of skillsToOnboard) {
      const sourcePath = path.join(toolSkillsDir, sName);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(sourcePath);
      } catch {
        continue; // Skip missing files or broken links
      }

      // Skip if already a symlink
      if (stat.isSymbolicLink()) {
        continue;
      }

      // Determine scope
      const isGlobal = options.scope !== 'tool-specific';

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
          // Will be removed if selected
        } else {
          continue;
        }
      }

      if (fs.existsSync(hubToolPath)) {
        if (isDirEmpty(hubToolPath)) {
          // Will be removed if selected
        } else {
          continue;
        }
      }

      candidates.push({
        tool,
        skillName: sName,
        sourcePath,
        hubGlobalPath,
        hubToolPath,
        isGlobal,
      });
    }
  }

  // Interactive selection if not explicitly targeting a single skill name and not --yes
  let selectedCandidates = candidates;
  if (!skillName && !options.yes && candidates.length > 0) {
    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select skills to onboard into the Hub:',
        choices: candidates.map((c, index) => ({
          name: `${c.tool.name}/${c.skillName}`,
          value: index,
          checked: true,
        })),
      },
    ]);
    selectedCandidates = selected.map((idx: number) => candidates[idx]);
  }

  const onboarded: string[] = [];

  for (const c of selectedCandidates) {
    const isDirEmpty = (dirPath: string) => {
      try {
        return fs.readdirSync(dirPath).length === 0;
      } catch {
        return false;
      }
    };

    if (fs.existsSync(c.hubGlobalPath) && isDirEmpty(c.hubGlobalPath)) {
      fs.rmdirSync(c.hubGlobalPath);
    }
    if (fs.existsSync(c.hubToolPath) && isDirEmpty(c.hubToolPath)) {
      fs.rmdirSync(c.hubToolPath);
    }

    // Move to hub
    if (c.isGlobal) {
      if (!fs.existsSync(c.hubGlobalPath)) {
        fs.mkdirSync(path.dirname(c.hubGlobalPath), { recursive: true });
        fs.renameSync(c.sourcePath, c.hubGlobalPath);
      } else {
        // If it was already onboarded in a previous iteration (e.g. from another tool),
        // we can just delete this local physical folder and create a symlink to it.
        fs.rmSync(c.sourcePath, { recursive: true, force: true });
      }
      createSymlink(c.sourcePath, c.hubGlobalPath);
    } else {
      if (!fs.existsSync(c.hubToolPath)) {
        fs.mkdirSync(path.dirname(c.hubToolPath), { recursive: true });
        fs.renameSync(c.sourcePath, c.hubToolPath);
      } else {
        fs.rmSync(c.sourcePath, { recursive: true, force: true });
      }
      createSymlink(c.sourcePath, c.hubToolPath);
    }

    onboarded.push(`${c.tool.name}/${c.skillName}`);
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
