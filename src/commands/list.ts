/**
 * List command - list all skills in hub
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { readSkillMeta } from '../utils/skill-meta.js';

export interface ListOptions {
  hubPath: string;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const skillsDir = path.join(options.hubPath, 'skills');
  const toolsDir = path.join(options.hubPath, 'tools');

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
          console.log(`  ${toolDir.name}/${meta.name.padEnd(18)} ${meta.description || ''}`);
        }
      }
    }
  }
}
