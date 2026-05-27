import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { initCommand } from '../../src/commands/init.js';
import { addCommand } from '../../src/commands/add.js';
import { syncCommand } from '../../src/commands/sync.js';
import { onboardCommand } from '../../src/commands/onboard.js';
import { removeCommand } from '../../src/commands/remove.js';
import { listCommand } from '../../src/commands/list.js';
import { statusCommand } from '../../src/commands/status.js';

describe('end-to-end workflow', () => {
  const tmpDir = path.join(os.tmpdir(), 'skills-sync-integration-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('full lifecycle: init → add → status → sync → onboard → remove', async () => {
    // Setup: create two tools with some skills
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'check'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'check', 'SKILL.md'), '# Check\n\nReview checklist.');
    fs.mkdirSync(path.join(tmpDir, '.codex', 'skills', 'check'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.codex', 'skills', 'check', 'SKILL.md'), '# Check\n\nReview checklist.');
    fs.mkdirSync(path.join(tmpDir, '.gemini', 'skills', 'lark'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.gemini', 'skills', 'lark', 'SKILL.md'), '# Lark\n\nLark workflow.');

    const hubPath = path.join(tmpDir, 'hub');

    // 1. Init
    await initCommand({ hubPath, yes: true, homeDir: tmpDir });
    expect(fs.existsSync(path.join(hubPath, '.skills-sync.toml'))).toBe(true);
    expect(fs.existsSync(path.join(hubPath, 'skills', 'check'))).toBe(true);
    expect(fs.existsSync(path.join(hubPath, 'tools', 'gemini', 'lark'))).toBe(true);

    // 2. Add a new skill
    const newSkillDir = path.join(tmpDir, 'new-skill');
    fs.mkdirSync(newSkillDir, { recursive: true });
    fs.writeFileSync(path.join(newSkillDir, 'SKILL.md'), '---\nname: new-skill\ndescription: A new skill\n---\n\n# New Skill');

    await addCommand({ hubPath, skillPath: newSkillDir, scope: 'global', homeDir: tmpDir });
    expect(fs.existsSync(path.join(hubPath, 'skills', 'new-skill'))).toBe(true);
    expect(fs.lstatSync(path.join(tmpDir, '.claude', 'skills', 'new-skill')).isSymbolicLink()).toBe(true);

    // 3. Status (smoke test - should not throw)
    await statusCommand({ hubPath, homeDir: tmpDir });

    // 4. List (smoke test - should not throw)
    await listCommand({ hubPath });

    // 5. Create a broken symlink scenario and fix with sync
    fs.unlinkSync(path.join(tmpDir, '.claude', 'skills', 'check'));
    await syncCommand({ hubPath, fix: true, homeDir: tmpDir });
    expect(fs.lstatSync(path.join(tmpDir, '.claude', 'skills', 'check')).isSymbolicLink()).toBe(true);

    // 6. Onboard a skill
    const orphanSkill = path.join(tmpDir, '.claude', 'skills', 'orphan');
    fs.mkdirSync(orphanSkill, { recursive: true });
    fs.writeFileSync(path.join(orphanSkill, 'SKILL.md'), '# Orphan');

    await onboardCommand({ hubPath, toolName: 'claude', skillName: 'orphan', scope: 'global', homeDir: tmpDir });
    expect(fs.existsSync(path.join(hubPath, 'skills', 'orphan'))).toBe(true);
    expect(fs.lstatSync(orphanSkill).isSymbolicLink()).toBe(true);

    // 7. Remove a skill
    await removeCommand({ hubPath, skillName: 'new-skill', homeDir: tmpDir });
    expect(!fs.existsSync(path.join(hubPath, 'skills', 'new-skill'))).toBe(true);
    expect(!fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'new-skill'))).toBe(true);
  });
});
