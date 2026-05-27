import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readSkillMeta, computeSkillHash } from '../../../src/utils/skill-meta.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('skill-meta', () => {
  const tmpDir = path.join(os.tmpdir(), 'skills-sync-meta-test-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('readSkillMeta', () => {
    it('parses SKILL.md with YAML frontmatter', () => {
      const skillDir = path.join(tmpDir, 'check');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---
name: check
description: Code review checklist
metadata:
  internal: false
---

# Check

Run this checklist before every commit.
`,
      );

      const meta = readSkillMeta(skillDir);
      expect(meta.name).toBe('check');
      expect(meta.description).toBe('Code review checklist');
      expect(meta.metadata).toEqual({ internal: false });
    });

    it('returns defaults when SKILL.md has no frontmatter', () => {
      const skillDir = path.join(tmpDir, 'plain-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '# Plain Skill\n\nNo frontmatter here.',
      );

      const meta = readSkillMeta(skillDir);
      expect(meta.name).toBe('plain-skill');
      expect(meta.description).toBe('');
      expect(meta.metadata).toBeUndefined();
    });

    it('returns defaults when SKILL.md is missing', () => {
      const skillDir = path.join(tmpDir, 'no-skill-file');
      fs.mkdirSync(skillDir, { recursive: true });

      const meta = readSkillMeta(skillDir);
      expect(meta.name).toBe('no-skill-file');
      expect(meta.description).toBe('');
    });

    it('derives name from directory name', () => {
      const skillDir = path.join(tmpDir, 'my-awesome-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Hello');

      const meta = readSkillMeta(skillDir);
      expect(meta.name).toBe('my-awesome-skill');
    });
  });

  describe('computeSkillHash', () => {
    it('computes consistent hash for same content', () => {
      const skillDir = path.join(tmpDir, 'hash-test');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'content');
      fs.writeFileSync(path.join(skillDir, 'extra.md'), 'extra');

      const hash1 = computeSkillHash(skillDir);
      const hash2 = computeSkillHash(skillDir);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('produces different hash for different content', () => {
      const skillDir1 = path.join(tmpDir, 'skill-a');
      const skillDir2 = path.join(tmpDir, 'skill-b');
      fs.mkdirSync(skillDir1, { recursive: true });
      fs.mkdirSync(skillDir2, { recursive: true });
      fs.writeFileSync(path.join(skillDir1, 'SKILL.md'), 'content-a');
      fs.writeFileSync(path.join(skillDir2, 'SKILL.md'), 'content-b');

      const hash1 = computeSkillHash(skillDir1);
      const hash2 = computeSkillHash(skillDir2);
      expect(hash1).not.toBe(hash2);
    });
  });
});
