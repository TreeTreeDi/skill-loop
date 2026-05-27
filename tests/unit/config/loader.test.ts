import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, saveConfig, getDefaultConfig, expandPath } from '../../../src/config/loader.js';
import type { HubConfig } from '../../../src/types.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('config loader', () => {
  const tmpDir = path.join(os.tmpdir(), 'skills-sync-test-' + Date.now());

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('expandPath', () => {
    it('expands ~ to home directory', () => {
      const result = expandPath('~/skills-hub');
      expect(result).toBe(path.join(os.homedir(), 'skills-hub'));
    });

    it('leaves absolute paths unchanged', () => {
      const absolute = '/absolute/path';
      expect(expandPath(absolute)).toBe(absolute);
    });

    it('leaves relative paths unchanged', () => {
      const relative = './relative/path';
      expect(expandPath(relative)).toBe(relative);
    });
  });

  describe('getDefaultConfig', () => {
    it('returns default config with known tools', () => {
      const config = getDefaultConfig();

      expect(config.version).toBe('1');
      expect(config.hub.path).toBe('~/skills-hub');
      expect(config.hub.autoCommit).toBe(true);
      expect(config.sync.defaultMode).toBe('symlink');
      expect(config.sync.prune).toBe(false);
      expect(config.tools.length).toBeGreaterThan(0);

      const claude = config.tools.find((t) => t.name === 'claude');
      expect(claude).toBeDefined();
      expect(claude!.skillsDir).toBe('~/.claude/skills');
      expect(claude!.enabled).toBe(true);
      expect(claude!.mode).toBe('symlink');
    });
  });

  describe('loadConfig', () => {
    it('loads config from file', () => {
      const configPath = path.join(tmpDir, '.skills-sync.toml');
      fs.writeFileSync(
        configPath,
        `
version = "1"

[hub]
path = "~/custom-hub"
autoCommit = false

[sync]
defaultMode = "copy"
prune = true

[[tools]]
name = "claude"
skillsDir = "~/.claude/skills"
enabled = true
mode = "symlink"
`,
      );

      const config = loadConfig(configPath);
      expect(config.hub.path).toBe('~/custom-hub');
      expect(config.hub.autoCommit).toBe(false);
      expect(config.sync.defaultMode).toBe('copy');
      expect(config.sync.prune).toBe(true);
    });

    it('falls back to default config when file does not exist', () => {
      const config = loadConfig(path.join(tmpDir, 'non-existent.toml'));
      expect(config.version).toBe('1');
      expect(config.tools.length).toBeGreaterThan(0);
    });

    it('merges partial config with defaults', () => {
      const configPath = path.join(tmpDir, '.skills-sync.toml');
      fs.writeFileSync(
        configPath,
        `
[hub]
path = "~/partial-hub"
`,
      );

      const config = loadConfig(configPath);
      expect(config.hub.path).toBe('~/partial-hub');
      expect(config.hub.autoCommit).toBe(true); // default
      expect(config.sync.defaultMode).toBe('symlink'); // default
      expect(config.tools.length).toBeGreaterThan(0); // default
    });
  });

  describe('saveConfig', () => {
    it('saves config to file', () => {
      const configPath = path.join(tmpDir, '.skills-sync.toml');
      const config: HubConfig = {
        version: '1',
        hub: { path: '~/test-hub', autoCommit: false },
        sync: { defaultMode: 'symlink', prune: false },
        tools: [
          { name: 'claude', skillsDir: '~/.claude/skills', enabled: true, mode: 'symlink' },
        ],
      };

      saveConfig(configPath, config);

      const raw = fs.readFileSync(configPath, 'utf-8');
      expect(raw).toContain('path = "~/test-hub"');
      expect(raw).toContain('name = "claude"');
      expect(raw).toContain('autoCommit = false');
    });
  });
});
