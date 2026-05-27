import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkToolStatus } from '../../../src/sync/status.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Tool } from '../../../src/types.js';

describe('sync status', () => {
  const tmpDir = path.join(os.tmpdir(), 'skills-sync-status-test-' + Date.now());
  let hubPath: string;

  beforeEach(() => {
    hubPath = path.join(tmpDir, 'hub');
    fs.mkdirSync(hubPath, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createHubSkill(name: string, content = 'default'): void {
    const dir = path.join(hubPath, 'skills', name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), content);
  }

  function createToolSkill(toolDir: string, name: string, content = 'default'): void {
    const dir = path.join(toolDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), content);
  }

  function createToolSymlink(toolDir: string, name: string, targetPath: string): void {
    const link = path.join(toolDir, name);
    fs.mkdirSync(toolDir, { recursive: true });
    fs.symlinkSync(targetPath, link, 'dir');
  }

  it('detects healthy symlink', () => {
    createHubSkill('check', 'check-content');
    const toolDir = path.join(tmpDir, '.claude', 'skills');
    createToolSymlink(toolDir, 'check', path.join(hubPath, 'skills', 'check'));

    const tool: Tool = { name: 'claude', skillsDir: toolDir, enabled: true, mode: 'symlink' };
    const report = checkToolStatus(tool, hubPath, ['check']);

    expect(report.skills).toHaveLength(1);
    expect(report.skills[0].status).toBe('healthy');
    expect(report.healthyCount).toBe(1);
  });

  it('detects broken symlink', () => {
    const toolDir = path.join(tmpDir, '.claude', 'skills');
    // Create symlink to non-existent target
    createToolSymlink(toolDir, 'check', path.join(hubPath, 'skills', 'check'));

    const tool: Tool = { name: 'claude', skillsDir: toolDir, enabled: true, mode: 'symlink' };
    const report = checkToolStatus(tool, hubPath, ['check']);

    expect(report.skills[0].status).toBe('broken');
    expect(report.brokenCount).toBe(1);
  });

  it('detects independent copy', () => {
    createHubSkill('check', 'hub-version');
    const toolDir = path.join(tmpDir, '.claude', 'skills');
    createToolSkill(toolDir, 'check', 'local-version');

    const tool: Tool = { name: 'claude', skillsDir: toolDir, enabled: true, mode: 'symlink' };
    const report = checkToolStatus(tool, hubPath, ['check']);

    expect(report.skills[0].status).toBe('copy');
    expect(report.copyCount).toBe(1);
  });

  it('detects missing skill', () => {
    createHubSkill('check');
    const toolDir = path.join(tmpDir, '.claude', 'skills');
    fs.mkdirSync(toolDir, { recursive: true });

    const tool: Tool = { name: 'claude', skillsDir: toolDir, enabled: true, mode: 'symlink' };
    const report = checkToolStatus(tool, hubPath, ['check']);

    expect(report.skills[0].status).toBe('missing');
    expect(report.missingCount).toBe(1);
  });

  it('counts multiple skills correctly', () => {
    createHubSkill('check');
    createHubSkill('design');
    createHubSkill('review');

    const toolDir = path.join(tmpDir, '.claude', 'skills');
    createToolSymlink(toolDir, 'check', path.join(hubPath, 'skills', 'check'));
    createToolSymlink(toolDir, 'design', path.join(hubPath, 'skills', 'design'));
    // review is missing

    const tool: Tool = { name: 'claude', skillsDir: toolDir, enabled: true, mode: 'symlink' };
    const report = checkToolStatus(tool, hubPath, ['check', 'design', 'review']);

    expect(report.healthyCount).toBe(2);
    expect(report.missingCount).toBe(1);
    expect(report.brokenCount).toBe(0);
    expect(report.copyCount).toBe(0);
  });
});
