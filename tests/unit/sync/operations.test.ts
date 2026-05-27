import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createSymlink,
  removeSymlink,
  createCopy,
  removeCopy,
  isSymlinkBroken,
  readSymlinkTarget,
} from '../../../src/sync/operations.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('sync operations', () => {
  const tmpDir = path.join(os.tmpdir(), 'skills-sync-ops-test-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('symlink', () => {
    it('creates a symlink pointing to target', () => {
      const target = path.join(tmpDir, 'hub', 'skill-a');
      const link = path.join(tmpDir, '.claude', 'skills', 'skill-a');
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, 'SKILL.md'), 'hello');

      createSymlink(link, target);

      expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
      expect(fs.readFileSync(path.join(link, 'SKILL.md'), 'utf-8')).toBe('hello');
    });

    it('removes a symlink', () => {
      const target = path.join(tmpDir, 'hub', 'skill-b');
      const link = path.join(tmpDir, '.claude', 'skills', 'skill-b');
      fs.mkdirSync(target, { recursive: true });
      createSymlink(link, target);

      removeSymlink(link);

      expect(fs.existsSync(link)).toBe(false);
      expect(fs.existsSync(target)).toBe(true); // Target preserved
    });

    it('detects broken symlink', () => {
      const target = path.join(tmpDir, 'hub', 'skill-c');
      const link = path.join(tmpDir, '.claude', 'skills', 'skill-c');
      fs.mkdirSync(target, { recursive: true });
      createSymlink(link, target);

      expect(isSymlinkBroken(link)).toBe(false);

      fs.rmSync(target, { recursive: true });
      expect(isSymlinkBroken(link)).toBe(true);
    });

    it('reads symlink target', () => {
      const target = path.join(tmpDir, 'hub', 'skill-d');
      const link = path.join(tmpDir, '.claude', 'skills', 'skill-d');
      fs.mkdirSync(target, { recursive: true });
      createSymlink(link, target);

      expect(readSymlinkTarget(link)).toBe(target);
    });

    it('returns null for non-symlink', () => {
      const file = path.join(tmpDir, 'not-a-link');
      fs.writeFileSync(file, 'content');
      expect(readSymlinkTarget(file)).toBeNull();
    });
  });

  describe('copy', () => {
    it('creates a recursive copy', () => {
      const source = path.join(tmpDir, 'hub', 'skill-e');
      const dest = path.join(tmpDir, '.cursor', 'skills', 'skill-e');
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(path.join(source, 'SKILL.md'), 'content');
      fs.mkdirSync(path.join(source, 'subdir'));
      fs.writeFileSync(path.join(source, 'subdir', 'extra.md'), 'extra');

      createCopy(dest, source);

      expect(fs.lstatSync(dest).isDirectory()).toBe(true);
      expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf-8')).toBe('content');
      expect(fs.readFileSync(path.join(dest, 'subdir', 'extra.md'), 'utf-8')).toBe('extra');
    });

    it('removes a copy', () => {
      const dest = path.join(tmpDir, '.cursor', 'skills', 'skill-f');
      fs.mkdirSync(dest, { recursive: true });
      fs.writeFileSync(path.join(dest, 'SKILL.md'), 'x');

      removeCopy(dest);

      expect(fs.existsSync(dest)).toBe(false);
    });
  });
});
