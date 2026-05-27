import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { discoverTools } from '../../src/discovery.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('discoverTools', () => {
  const tmpHome = path.join(os.tmpdir(), 'skills-sync-discovery-test-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpHome, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('discovers tools with existing skills directories', () => {
    fs.mkdirSync(path.join(tmpHome, '.claude', 'skills', 'check'), { recursive: true });
    fs.mkdirSync(path.join(tmpHome, '.claude', 'skills', 'design'), { recursive: true });
    fs.mkdirSync(path.join(tmpHome, '.codex', 'skills', 'review'), { recursive: true });
    fs.mkdirSync(path.join(tmpHome, '.gemini', 'skills', 'test'), { recursive: true });

    const results = discoverTools(tmpHome);

    const claude = results.find((r) => r.name === 'claude');
    expect(claude).toBeDefined();
    expect(claude!.exists).toBe(true);
    expect(claude!.skillCount).toBe(2);

    const codex = results.find((r) => r.name === 'codex');
    expect(codex).toBeDefined();
    expect(codex!.exists).toBe(true);
    expect(codex!.skillCount).toBe(1);

    const gemini = results.find((r) => r.name === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini!.exists).toBe(true);
    expect(gemini!.skillCount).toBe(1);
  });

  it('marks tools as non-existent when directory is missing', () => {
    const results = discoverTools(tmpHome);

    const claude = results.find((r) => r.name === 'claude');
    expect(claude).toBeDefined();
    expect(claude!.exists).toBe(false);
    expect(claude!.skillCount).toBe(0);
  });

  it('ignores non-skill files in skills directory', () => {
    fs.mkdirSync(path.join(tmpHome, '.claude', 'skills'), { recursive: true });
    fs.writeFileSync(path.join(tmpHome, '.claude', 'skills', 'random-file.txt'), 'hello');
    fs.mkdirSync(path.join(tmpHome, '.claude', 'skills', 'real-skill'), { recursive: true });

    const results = discoverTools(tmpHome);
    const claude = results.find((r) => r.name === 'claude');
    expect(claude!.skillCount).toBe(1);
  });

  it('includes registered flag', () => {
    const results = discoverTools(tmpHome);
    for (const result of results) {
      expect(result.registered).toBe(true);
    }
  });
});
