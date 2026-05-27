import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import inquirer from 'inquirer';
import { loadConfig, expandPath } from '../config/loader.js';
import { createSymlink, createCopy } from '../sync/operations.js';
import { checkToolStatus } from '../sync/status.js';

export interface SyncOptions {
  hubPath: string;
  fix?: boolean;
  prune?: boolean;
  homeDir?: string;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
  const homeDir = options.homeDir ?? os.homedir();
  const configPath = path.join(options.hubPath, '.skills-sync.toml');
  const config = loadConfig(configPath);
  const hubPath = expandPath(config.hub.path, homeDir);

  const skillsDir = path.join(hubPath, 'skills');
  const globalSkills = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
    : [];

  let fixed = 0;
  let skipped = 0;
  const pruneCandidates: { toolName: string; skillName: string; fullPath: string }[] = [];

  for (const tool of config.tools) {
    if (!tool.enabled) continue;

    const toolSkillsDir = expandPath(tool.skillsDir, homeDir);
    const report = checkToolStatus(tool, hubPath, globalSkills, toolSkillsDir);

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
          if (!skill.targetPath) {
            skipped++;
            continue;
          }
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

    // Collect prune candidates: remove skills from tool that are not in hub
    if (options.prune && fs.existsSync(toolSkillsDir)) {
      const toolEntries = fs.readdirSync(toolSkillsDir, { withFileTypes: true })
        .filter((e) => {
          if (e.name.startsWith('.')) return false;
          if (e.isDirectory()) return true;
          if (e.isSymbolicLink()) return true;
          return false;
        });

      const allHubSkills = new Set(globalSkills);
      const toolSpecificDir = path.join(hubPath, 'tools', tool.name);
      if (fs.existsSync(toolSpecificDir)) {
        const specificSkills = fs.readdirSync(toolSpecificDir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
          .map((e) => e.name);
        for (const s of specificSkills) allHubSkills.add(s);
      }

      for (const entry of toolEntries) {
        if (!allHubSkills.has(entry.name)) {
          pruneCandidates.push({
            toolName: tool.name,
            skillName: entry.name,
            fullPath: path.join(toolSkillsDir, entry.name),
          });
        }
      }
    }
  }

  // Handle prune with confirmation
  if (options.prune && pruneCandidates.length > 0) {
    console.log('\nFound local skills that are not in the hub:');
    for (const item of pruneCandidates) {
      console.log(`  - [${item.toolName}] ${item.skillName} (${item.fullPath})`);
    }
    console.log('');

    const { confirmPrune } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmPrune',
        message: `Are you sure you want to delete these ${pruneCandidates.length} local skills? This action cannot be undone.`,
        default: false,
      },
    ]);

    if (confirmPrune) {
      for (const item of pruneCandidates) {
        fs.rmSync(item.fullPath, { recursive: true, force: true });
        fixed++;
      }
      console.log(`✓ Pruned ${pruneCandidates.length} local skills.`);
    } else {
      console.log('Prune cancelled.');
    }
  }

  // Clean up hub/tools/ directories for tools not in config
  const hubToolsDir = path.join(hubPath, 'tools');
  if (fs.existsSync(hubToolsDir)) {
    const configToolNames = new Set(config.tools.map((t) => t.name));
    const hubToolDirs = fs.readdirSync(hubToolsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory());

    for (const dir of hubToolDirs) {
      if (!configToolNames.has(dir.name)) {
        const orphanPath = path.join(hubToolsDir, dir.name);
        fs.rmSync(orphanPath, { recursive: true, force: true });
        fixed++;
        console.log(`Removed orphan tool directory: ${dir.name}`);
      }
    }
  }

  console.log(`Sync complete: ${fixed} fixed, ${skipped} skipped`);
  if (skipped > 0) {
    console.log('Use --fix to repair broken symlinks.');
  }
}
