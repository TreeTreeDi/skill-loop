/**
 * Skill metadata reading and hashing utilities
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { Skill } from '../types.js';

interface SkillMeta {
  name: string;
  description: string;
  metadata?: Record<string, unknown>;
}

function parseYamlFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const lines = match[1].split('\n');
  const frontmatter: Record<string, unknown> = {};
  let currentKey = '';
  let indentStack: { key: string; indent: number }[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Simple key: value parsing (supports one level of nesting)
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value: unknown = trimmed.slice(colonIndex + 1).trim();

    // Handle nested objects (simple heuristic)
    if (value === '') {
      // Start of nested object
      if (indentStack.length === 0 || indent > indentStack[indentStack.length - 1].indent) {
        indentStack.push({ key, indent });
        currentKey = key;
      }
      continue;
    }

    // Parse primitive values
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (value === 'null' || value === '~') value = null;
    else if (/^-?\d+$/.test(value as string)) value = parseInt(value as string, 10);
    else if (/^-?\d+\.\d+$/.test(value as string)) value = parseFloat(value as string);
    else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
      value = (value as string).slice(1, -1);
    } else if ((value as string).startsWith("'") && (value as string).endsWith("'")) {
      value = (value as string).slice(1, -1);
    }

    if (indentStack.length > 0 && indent > indentStack[indentStack.length - 1].indent) {
      // Nested value
      const parentKey = indentStack[indentStack.length - 1].key;
      if (!frontmatter[parentKey]) frontmatter[parentKey] = {};
      (frontmatter[parentKey] as Record<string, unknown>)[key] = value;
    } else {
      indentStack = [];
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body: match[2].trim() };
}

export function readSkillMeta(skillDir: string): SkillMeta {
  const dirName = path.basename(skillDir);
  const skillFile = path.join(skillDir, 'SKILL.md');

  const defaults: SkillMeta = {
    name: dirName,
    description: '',
  };

  if (!fs.existsSync(skillFile)) {
    return defaults;
  }

  const content = fs.readFileSync(skillFile, 'utf-8');
  const parsed = parseYamlFrontmatter(content);

  if (!parsed) {
    return defaults;
  }

  return {
    name: (parsed.frontmatter.name as string) || defaults.name,
    description: (parsed.frontmatter.description as string) || defaults.description,
    metadata: parsed.frontmatter.metadata as Record<string, unknown> | undefined,
  };
}

export function computeSkillHash(skillDir: string): string {
  const hash = crypto.createHash('sha256');

  function hashDir(dir: string, prefix: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        hash.update(`d:${relativePath}\n`);
        hashDir(fullPath, relativePath);
      } else {
        hash.update(`f:${relativePath}\n`);
        const content = fs.readFileSync(fullPath);
        hash.update(content);
      }
    }
  }

  hashDir(skillDir, '');
  return hash.digest('hex');
}

export function readSkill(skillDir: string): Skill {
  const meta = readSkillMeta(skillDir);
  return {
    ...meta,
    path: skillDir,
    hash: computeSkillHash(skillDir),
  };
}
