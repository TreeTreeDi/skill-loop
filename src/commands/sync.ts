/**
 * Sync command - synchronize hub state with all tools
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, expandPath } from '../config/loader.js';
import { createSymlink, createCopy, isSymlinkBroken } from '../sync/operations.js';
import { checkToolStatus } from '../sync/status.js';

export interface SyncOptions {
  hubPath: string;
  fix?: boolean;
  homeDir?: string;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
  const homeDir = options.homeDir ?? os.homedir();
  const configPath = path.join(options.hubPath, '.skills-sync.toml');
  const config = loadConfig(configPath);
  const hubPath = expandPath(config.hub.path, homeDir);

  const skillsDir = path.join(hubPath, 'skills');
  const globalSkills = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];

  let fixed = 0;
  let skipped = 0;

  for (const tool of config.tools) {
    if (!tool.enabled) continue;

    const toolSkillsDir = expandPath(tool.skillsDir, homeDir);
    const report = checkToolStatus(tool, hubPath, globalSkills);

    for (const skill of report.skills) {
      const toolSkillPath = path.join(toolSkillsDir, skill.skill.name);

      if (skill.status === 'missing') {
        const mode = tool.mode ?? config.sync.defaultMode;
        if (mode === 'symlink') {
          createSymlink(toolSkillPath, skill.targetPath);
        } else {
          createCopy(toolSkillPath, skill.targetPath);
        }
        fixed++;
      } else if (skill.status === 'broken') {
        if (options.fix) {
          fs.unlinkSync(toolSkillPath);
          const mode = tool.mode ?? config.sync.defaultMode;
          if (mode === 'symlink') {
            createSymlink(toolSkillPath, skill.targetPath);
          } else {
            createCopy(toolSkillPath, skill.targetPath);
          }
          fixed++;
        } else {
          skipped++;
        }
      }
    }

    // Handle prune: remove skills from tool that are not in hub
    if (config.sync.prune && fs.existsSync(toolSkillsDir)) {
      const toolEntries = fs.readdirSync(toolSkillsDir, { withFileTypes: true })
        .filter((e) => {
          if (e.name.startsWith('.')) return false;
          if (e.isDirectory()) return true;
          if (e.isSymbolicLink()) {
            return fs.existsSync(path.join(toolSkillsDir, e.name));
          }
          return false;
        });

      const allHubSkills = new Set(globalSkills);
      const toolSpecificDir = path.join(hubPath, 'tools', tool.name);
      if (fs.existsSync(toolSpecificDir)) {
        const specificSkills = fs.readdirSync(toolSpecificDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => e.name);
        for (const s of specificSkills) allHubSkills.add(s);
      }

      for (const entry of toolEntries) {
        if (!allHubSkills.has(entry.name)) {
          const fullPath = path.join(toolSkillsDir, entry.name);
          fs.rmSync(fullPath, { recursive: true, force: true });
          fixed++;
        }
      }
    }
  }

  console.log(`Sync complete: ${fixed} fixed, ${skipped} skipped`);
  if (skipped > 0) {
    console.log('Use --fix to repair broken symlinks.');
  }
}
