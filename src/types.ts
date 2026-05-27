/**
 * Core types for skills-sync
 */

export interface Skill {
  name: string;
  description: string;
  path: string;
  metadata?: Record<string, unknown>;
  hash: string;
}

export type SyncMode = 'symlink' | 'copy';

export interface Tool {
  name: string;
  skillsDir: string;
  enabled: boolean;
  mode: SyncMode;
}

export interface HubConfig {
  version: string;
  hub: {
    path: string;
    autoCommit: boolean;
  };
  sync: {
    defaultMode: SyncMode;
    prune: boolean;
  };
  tools: Tool[];
}

export type SkillStatus = 'healthy' | 'broken' | 'copy' | 'missing';

export interface SkillSyncState {
  skill: Skill;
  status: SkillStatus;
  toolPath: string;
  targetPath: string;
}

export interface ToolSyncReport {
  tool: Tool;
  skills: SkillSyncState[];
  healthyCount: number;
  brokenCount: number;
  copyCount: number;
  missingCount: number;
}

export interface SyncStatusReport {
  hubPath: string;
  tools: ToolSyncReport[];
  totalSkills: number;
  totalHealthy: number;
  totalBroken: number;
  totalCopy: number;
  totalMissing: number;
}

export interface ToolDiscoveryResult {
  name: string;
  skillsDir: string;
  exists: boolean;
  skillCount: number;
  registered: boolean;
}
