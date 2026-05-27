/**
 * List command - interactive hierarchical skill browser (tool-centric view)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import inquirer from 'inquirer';
import { readSkillMeta } from '../utils/skill-meta.js';
import { removeCommand } from './remove.js';
import { loadConfig, expandPath } from '../config/loader.js';

export interface ListOptions {
  hubPath: string;
  yes?: boolean;
  homeDir?: string;
}

interface SkillInfo {
  name: string;
  description: string;
  fullPath: string;
  dirName: string;
  isGlobal: boolean; // true if symlink points to hub/skills/
}

interface SkillGroup {
  name: string;
  skills: SkillInfo[];
}

function collectToolSkills(toolSkillsDir: string, hubSkillsDir: string): SkillInfo[] {
  if (!fs.existsSync(toolSkillsDir)) return [];

  const entries = fs.readdirSync(toolSkillsDir, { withFileTypes: true })
    .filter((e) => {
      if (e.name.startsWith('.')) return false;
      if (e.isDirectory()) return true;
      if (e.isSymbolicLink()) {
        return fs.existsSync(path.join(toolSkillsDir, e.name));
      }
      return false;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries.map((e) => {
    const skillPath = path.join(toolSkillsDir, e.name);
    const meta = readSkillMeta(skillPath);

    // Check if this is a symlink pointing to global hub skills
    let isGlobal = false;
    if (e.isSymbolicLink()) {
      try {
        const target = fs.readlinkSync(skillPath);
        const resolvedTarget = path.resolve(toolSkillsDir, target);
        if (resolvedTarget.startsWith(path.resolve(hubSkillsDir))) {
          isGlobal = true;
        }
      } catch {
        // ignore
      }
    }

    return {
      name: meta.name,
      description: meta.description,
      fullPath: skillPath,
      dirName: e.name,
      isGlobal,
    };
  });
}

function collectGroups(hubPath: string, homeDir: string): SkillGroup[] {
  const groups: SkillGroup[] = [];
  const configPath = path.join(hubPath, '.skills-sync.toml');

  // Global skills from hub
  const hubSkillsDir = path.join(hubPath, 'skills');
  if (fs.existsSync(hubSkillsDir)) {
    const entries = fs.readdirSync(hubSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (entries.length > 0) {
      groups.push({
        name: 'Global',
        skills: entries.map((e) => {
          const meta = readSkillMeta(path.join(hubSkillsDir, e.name));
          return {
            name: meta.name,
            description: meta.description,
            fullPath: path.join(hubSkillsDir, e.name),
            dirName: e.name,
            isGlobal: true,
          };
        }),
      });
    }
  }

  // Tool-specific skills: read from each tool's actual skills directory
  if (fs.existsSync(configPath)) {
    const config = loadConfig(configPath);
    for (const tool of config.tools) {
      if (!tool.enabled) continue;

      const toolSkillsDir = expandPath(tool.skillsDir, homeDir);
      const skills = collectToolSkills(toolSkillsDir, hubSkillsDir);

      if (skills.length > 0) {
        groups.push({
          name: tool.name,
          skills,
        });
      }
    }
  }

  return groups;
}

function printAll(hubPath: string, homeDir: string): void {
  const groups = collectGroups(hubPath, homeDir);

  for (const group of groups) {
    console.log(`${group.name} (${group.skills.length} skills):`);
    for (const skill of group.skills) {
      const tag = skill.isGlobal ? '[global] ' : '';
      const desc = skill.description.length > 40 ? skill.description.slice(0, 40) + '...' : skill.description;
      console.log(`  ${tag}${skill.name.padEnd(20)} ${desc}`);
    }
    console.log('');
  }
}

async function promptWithEsc<T>(questions: any[], escValue: any): Promise<T> {
  const promptPromise = inquirer.prompt(questions);

  const handleKeypress = (char: string | undefined, key: any) => {
    if ((key && (key.name === 'escape' || key.name === 'esc')) || char === '\u001b') {
      promptPromise.ui.close();
    }
  };

  process.stdin.on('keypress', handleKeypress);

  try {
    const result = await promptPromise;
    return result;
  } catch (error: any) {
    const firstQuestionName = questions[0].name;
    return { [firstQuestionName]: escValue } as any;
  } finally {
    process.stdin.removeListener('keypress', handleKeypress);
  }
}

export async function listCommand(options: ListOptions): Promise<void> {
  const homeDir = options.homeDir ?? os.homedir();
  const groups = collectGroups(options.hubPath, homeDir);

  if (groups.length === 0) {
    console.log('No skills found in hub.');
    return;
  }

  if (options.yes) {
    printAll(options.hubPath, homeDir);
    return;
  }

  // Interactive: hierarchical navigation
  while (true) {
    const groupChoices = groups.map((g) => ({
      name: `${g.name}  (${g.skills.length} skills)`,
      value: g.name,
    }));

    const { selectedGroup } = await promptWithEsc<{ selectedGroup: string }>([
      {
        type: 'list',
        name: 'selectedGroup',
        message: 'Select a group (press ESC to exit):',
        choices: groupChoices,
        pageSize: 20,
      },
    ], '__exit__');

    if (selectedGroup === '__exit__') break;

    const group = groups.find((g) => g.name === selectedGroup)!;

    // Skill selection within group
    while (true) {
      const skillChoices = group.skills.map((s) => {
        const tag = s.isGlobal ? '[global] ' : '';
        const preview = s.description ? `  ${s.description.slice(0, 35)}${s.description.length > 35 ? '...' : ''}` : '';
        return { name: `${tag}${s.name}${preview}`, value: s.name };
      });

      const { selectedSkill } = await promptWithEsc<{ selectedSkill: string }>([
        {
          type: 'list',
          name: 'selectedSkill',
          message: `${group.name} — select a skill (press ESC to go back):`,
          choices: skillChoices,
          pageSize: 20,
        },
      ], '__back__');

      if (selectedSkill === '__back__') break;

      const skill = group.skills.find((s) => s.name === selectedSkill)!;

      // Skill detail view
      console.log('');
      console.log(`──────────────────────────────`);
      console.log(`  ${skill.name}`);
      if (skill.isGlobal) console.log(`  [global skill]`);
      if (skill.description) console.log(`  ${skill.description}`);
      console.log(`  Path: ${skill.fullPath}`);
      console.log(`──────────────────────────────`);
      console.log('');

      const { action } = await promptWithEsc<{ action: string }>([
        {
          type: 'list',
          name: 'action',
          message: 'Action (press ESC to go back):',
          choices: ['Remove this skill'],
        },
      ], '__back__');

      if (action === 'Remove this skill') {
        await removeCommand({ hubPath: options.hubPath, skillName: skill.dirName });
        // Refresh group skills after removal
        const refreshed = collectGroups(options.hubPath, homeDir);
        const refreshedGroup = refreshed.find((g) => g.name === group.name);
        if (refreshedGroup) {
          group.skills = refreshedGroup.skills;
        } else {
          groups.splice(groups.indexOf(group), 1);
        }
        console.log('');
        break; // Back to group selection
      }
      // Back: continue skill selection loop
    }
  }
}
