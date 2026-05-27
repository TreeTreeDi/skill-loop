import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { onboardCommand } from '../../../src/commands/onboard.js';
import { initCommand } from '../../../src/commands/init.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import inquirer from 'inquirer';

describe('onboard command', () => {
  const tmpDir = path.join(os.tmpdir(), 'skills-sync-onboard-test-' + Date.now());
  let hubPath: string;

  beforeEach(async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    hubPath = path.join(tmpDir, 'skills-hub');
    
    // Create the tool skills directories first so init registers them
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.gemini', 'skills'), { recursive: true });
    
    // Pre-initialize a hub
    await initCommand({ hubPath, yes: true, homeDir: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('automatically onboards everything if yes is true', async () => {
    // Create orphan skills in claude and gemini
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'orphan-a'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'orphan-a', 'SKILL.md'), 'a-content');

    fs.mkdirSync(path.join(tmpDir, '.gemini', 'skills', 'orphan-b'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.gemini', 'skills', 'orphan-b', 'SKILL.md'), 'b-content');

    await onboardCommand({ hubPath, yes: true, homeDir: tmpDir });

    // Should onboard both
    expect(fs.existsSync(path.join(hubPath, 'skills', 'orphan-a', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(hubPath, 'skills', 'orphan-b', 'SKILL.md'))).toBe(true);

    expect(fs.lstatSync(path.join(tmpDir, '.claude', 'skills', 'orphan-a')).isSymbolicLink()).toBe(true);
    expect(fs.lstatSync(path.join(tmpDir, '.gemini', 'skills', 'orphan-b')).isSymbolicLink()).toBe(true);
  });

  it('prompts user and only onboards selected items', async () => {
    // Create orphan skills in claude
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'orphan-a'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'orphan-a', 'SKILL.md'), 'a-content');

    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'orphan-b'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'orphan-b', 'SKILL.md'), 'b-content');

    // Mock prompt to only select the first candidate (orphan-a)
    const spy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({
      selected: [0], // value is index in candidates array
    });

    await onboardCommand({ hubPath, yes: false, homeDir: tmpDir });

    // orphan-a should be onboarded
    expect(fs.existsSync(path.join(hubPath, 'skills', 'orphan-a', 'SKILL.md'))).toBe(true);
    expect(fs.lstatSync(path.join(tmpDir, '.claude', 'skills', 'orphan-a')).isSymbolicLink()).toBe(true);

    // orphan-b should be untouched
    expect(fs.existsSync(path.join(hubPath, 'skills', 'orphan-b'))).toBe(false);
    expect(fs.lstatSync(path.join(tmpDir, '.claude', 'skills', 'orphan-b')).isSymbolicLink()).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'orphan-b', 'SKILL.md'))).toBe(true);

    expect(spy).toHaveBeenCalled();
  });

  it('automatically onboards single skill directly without prompt if skill name is passed', async () => {
    // Create orphan skill in claude
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills', 'orphan-a'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.claude', 'skills', 'orphan-a', 'SKILL.md'), 'a-content');

    const spy = vi.spyOn(inquirer, 'prompt');

    await onboardCommand({ hubPath, toolName: 'claude', skillName: 'orphan-a', yes: false, homeDir: tmpDir });

    // Should onboard direct target
    expect(fs.existsSync(path.join(hubPath, 'skills', 'orphan-a', 'SKILL.md'))).toBe(true);
    expect(fs.lstatSync(path.join(tmpDir, '.claude', 'skills', 'orphan-a')).isSymbolicLink()).toBe(true);

    // Prompt should NOT be called
    expect(spy).not.toHaveBeenCalled();
  });
});
