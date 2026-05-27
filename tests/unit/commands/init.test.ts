import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initCommand } from '../../../src/commands/init.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import inquirer from 'inquirer';

describe('init command', () => {
  const tmpDir = path.join(os.tmpdir(), 'skills-sync-init-test-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates hub directory structure', async () => {
    const hubPath = path.join(tmpDir, 'skills-hub');
    await initCommand({ hubPath, yes: true, homeDir: tmpDir });

    expect(fs.existsSync(path.join(hubPath, 'skills'))).toBe(true);
    expect(fs.existsSync(path.join(hubPath, 'tools'))).toBe(false);
    expect(fs.existsSync(path.join(hubPath, '.skills-sync.toml'))).toBe(true);
    expect(fs.existsSync(path.join(hubPath, '.git'))).toBe(true);
  });

  it('imports global skills from multiple tools', async () => {
    // Create tools with shared skill
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'check'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'check', 'SKILL.md'), 'check-content');
    fs.mkdirSync(path.join(tmpDir, '.codex', 'skills', 'check'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.codex', 'skills', 'check', 'SKILL.md'), 'check-content');

    const hubPath = path.join(tmpDir, 'skills-hub');
    await initCommand({ hubPath, yes: true, homeDir: tmpDir });

    // Skill should be in hub/skills/
    expect(fs.existsSync(path.join(hubPath, 'skills', 'check', 'SKILL.md'))).toBe(true);
    // And symlinked back to tools
    expect(fs.lstatSync(path.join(tmpDir, '.claude', 'skills', 'check')).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(tmpDir, '.codex', 'skills', 'check')).isSymbolicLink()).toBe(true);
  });

  it('imports all found skills as global skills', async () => {
    // Create tool with unique skill
    fs.mkdirSync(path.join(tmpDir, '.gemini', 'skills', 'lark-approval'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.gemini', 'skills', 'lark-approval', 'SKILL.md'), 'lark-content');

    const hubPath = path.join(tmpDir, 'skills-hub');
    await initCommand({ hubPath, yes: true, homeDir: tmpDir });

    // Should be in hub/skills/
    expect(fs.existsSync(path.join(hubPath, 'skills', 'lark-approval', 'SKILL.md'))).toBe(true);
    // And symlinked back
    expect(fs.lstatSync(path.join(tmpDir, '.gemini', 'skills', 'lark-approval')).isSymbolicLink()).toBe(true);
  });

  it('skips broken symlinks instead of crashing', async () => {
    // Create a global skill shared by two tools, plus a broken symlink
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'check'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'check', 'SKILL.md'), 'check-content');
    fs.mkdirSync(path.join(tmpDir, '.codex', 'skills', 'check'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.codex', 'skills', 'check', 'SKILL.md'), 'check-content');

    // Create a broken symlink pointing to a non-existent target
    fs.symlinkSync('/nonexistent/path', path.join(tmpDir, '.claude', 'skills', 'graphify'));

    const hubPath = path.join(tmpDir, 'skills-hub');

    // Should not throw ENOENT
    await initCommand({ hubPath, yes: true, homeDir: tmpDir });

    // Valid global skill should still be imported
    expect(fs.existsSync(path.join(hubPath, 'skills', 'check', 'SKILL.md'))).toBe(true);
    // Broken symlink should be ignored (not in hub)
    expect(fs.existsSync(path.join(hubPath, 'skills', 'graphify'))).toBe(false);
  });

  it('skips hidden directories like .archive and broken symlinks inside them', async () => {
    // Create a valid global skill
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'check'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'check', 'SKILL.md'), 'check-content');
    fs.mkdirSync(path.join(tmpDir, '.codex', 'skills', 'check'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.codex', 'skills', 'check', 'SKILL.md'), 'check-content');

    // Create a hidden .archive dir with a broken symlink inside
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', '.archive'), { recursive: true });
    fs.symlinkSync('/nonexistent/path', path.join(tmpDir, '.claude', 'skills', '.archive', 'kami-duplicate'));

    const hubPath = path.join(tmpDir, 'skills-hub');

    // Should not throw ENOENT from inside .archive
    await initCommand({ hubPath, yes: true, homeDir: tmpDir });

    // Valid skill should still be imported
    expect(fs.existsSync(path.join(hubPath, 'skills', 'check', 'SKILL.md'))).toBe(true);
    // .archive should be ignored entirely
    expect(fs.existsSync(path.join(hubPath, 'skills', '.archive'))).toBe(false);
  });

  it('leaves unselected skills untouched in the agent directory', async () => {
    // Create tools with skills
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'skill-a'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'skill-a', 'SKILL.md'), 'content-a');
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'skill-b'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'skill-b', 'SKILL.md'), 'content-b');

    // Spy on inquirer.prompt and mock return value to only select 'skill-a'
    const spy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({
      selected: ['skill-a'],
    });

    const hubPath = path.join(tmpDir, 'skills-hub');
    await initCommand({ hubPath, yes: false, homeDir: tmpDir });

    // skill-a should be in hub and symlinked
    expect(fs.existsSync(path.join(hubPath, 'skills', 'skill-a', 'SKILL.md'))).toBe(true);
    expect(fs.lstatSync(path.join(tmpDir, '.claude', 'skills', 'skill-a')).isSymbolicLink()).toBe(true);

    // skill-b should NOT be in hub and should NOT be symlinked (remains a physical folder)
    expect(fs.existsSync(path.join(hubPath, 'skills', 'skill-b'))).toBe(false);
    expect(fs.lstatSync(path.join(tmpDir, '.claude', 'skills', 'skill-b')).isSymbolicLink()).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'skill-b', 'SKILL.md'))).toBe(true);

    spy.mockRestore();
  });

  it('throws when hub already exists', async () => {
    const hubPath = path.join(tmpDir, 'skills-hub');
    fs.mkdirSync(hubPath, { recursive: true });

    await expect(initCommand({ hubPath, homeDir: tmpDir })).rejects.toThrow('Hub already exists');
  });
});
