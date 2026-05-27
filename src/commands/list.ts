/**
 * List command - interactive list of all skills in hub
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import inquirer from 'inquirer';
import { readSkillMeta } from '../utils/skill-meta.js';
import { removeCommand } from './remove.js';

export interface ListOptions {
  hubPath: string;
  yes?: boolean;
}

interface SkillEntry {
  name: string;
  display: string;
  type: 'global' | 'tool-specific';
}

export async function listCommand(options: ListOptions): Promise<void> {
  const skillsDir = path.join(options.hubPath, 'skills');
  const toolsDir = path.join(options.hubPath, 'tools');
  const allSkills: SkillEntry[] = [];

  console.log('Global skills:');
  if (fs.existsSync(skillsDir)) {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    if (entries.length === 0) {
      console.log('  (none)');
    } else {
      for (const entry of entries) {
        const meta = readSkillMeta(path.join(skillsDir, entry.name));
        console.log(`  ${meta.name.padEnd(20)} ${meta.description || ''}`);
        allSkills.push({ name: meta.name, display: meta.name, type: 'global' });
      }
    }
  }

  console.log('');
  console.log('Tool-specific skills:');
  if (fs.existsSync(toolsDir)) {
    const toolDirs = fs.readdirSync(toolsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    if (toolDirs.length === 0) {
      console.log('  (none)');
    } else {
      for (const toolDir of toolDirs) {
        const skillDirs = fs.readdirSync(path.join(toolsDir, toolDir.name), { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .sort((a, b) => a.name.localeCompare(b.name));

        for (const skillDir of skillDirs) {
          const meta = readSkillMeta(path.join(toolsDir, toolDir.name, skillDir.name));
          const display = `${toolDir.name}/${meta.name}`;
          console.log(`  ${display.padEnd(18)} ${meta.description || ''}`);
          allSkills.push({ name: meta.name, display, type: 'tool-specific' });
        }
      }
    }
  }

  if (allSkills.length === 0 || options.yes) return;

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Select action:',
      choices: ['Exit', 'Remove skills'],
    },
  ]);

  if (action === 'Remove skills') {
    const choices = allSkills.map((s) => ({
      name: s.display,
      value: s.name,
      checked: false,
    }));

    const { selected } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selected',
        message: 'Select skills to remove:',
        choices,
      },
    ]);

    for (const skillName of selected) {
      await removeCommand({ hubPath: options.hubPath, skillName });
    }
  }
}
