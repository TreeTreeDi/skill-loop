/**
 * Status checking engine - compare hub state with tool directories
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Tool, Skill, SkillStatus, ToolSyncReport, SyncStatusReport, SkillSyncState } from '../types.js';
import { readSkill, computeSkillHash } from '../utils/skill-meta.js';
import { isSymlinkBroken, readSymlinkTarget } from './operations.js';

export function checkSkillStatus(skillName: string, toolSkillsDir: string, hubPath: string, hubSkillNames: string[]): SkillSyncState {
  const toolSkillPath = path.join(toolSkillsDir, skillName);
  const hubSkillPath = path.join(hubPath, 'skills', skillName);

  // Skill not in hub
  if (!hubSkillNames.includes(skillName)) {
    // Check if it's a tool-specific skill
    const toolSpecificPath = path.join(hubPath, 'tools');
    const tools = fs.existsSync(toolSpecificPath) ? fs.readdirSync(toolSpecificPath, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name) : [];

    for (const toolName of tools) {
      const specificSkillPath = path.join(toolSpecificPath, toolName, skillName);
      if (fs.existsSync(specificSkillPath)) {
        // This is a tool-specific skill, check its status
        return checkSingleSkillStatus(skillName, toolSkillPath, specificSkillPath);
      }
    }
  }

  const actualHubPath = fs.existsSync(hubSkillPath) ? hubSkillPath : undefined;
  return checkSingleSkillStatus(skillName, toolSkillPath, actualHubPath);
}

function checkSingleSkillStatus(skillName: string, toolSkillPath: string, hubSkillPath: string | undefined): SkillSyncState {
  // First check if toolSkillPath exists (including as broken symlink)
  const toolExists = fs.existsSync(toolSkillPath);
  let isLink = false;
  let isBroken = false;

  if (toolExists) {
    const toolStat = fs.lstatSync(toolSkillPath);
    isLink = toolStat.isSymbolicLink();
    if (isLink) {
      isBroken = isSymlinkBroken(toolSkillPath);
    }
  } else {
    // Check for broken symlink (exists as symlink but target is gone)
    try {
      const lstat = fs.lstatSync(toolSkillPath);
      if (lstat.isSymbolicLink()) {
        isLink = true;
        isBroken = true;
      }
    } catch {
      // Path does not exist at all
    }
  }

  const skill: Skill = hubSkillPath && fs.existsSync(hubSkillPath)
    ? readSkill(hubSkillPath)
    : { name: skillName, description: '', path: toolSkillPath, hash: '' };

  if (isBroken) {
    return { skill, status: 'broken', toolPath: toolSkillPath, targetPath: hubSkillPath || '' };
  }

  if (!toolExists) {
    return { skill, status: 'missing', toolPath: toolSkillPath, targetPath: hubSkillPath || '' };
  }

  if (isLink) {
    return { skill, status: 'healthy', toolPath: toolSkillPath, targetPath: hubSkillPath || '' };
  }

  // It's an independent copy
  return { skill, status: 'copy', toolPath: toolSkillPath, targetPath: hubSkillPath || '' };
}

export function checkToolStatus(tool: Tool, hubPath: string, hubSkillNames: string[], toolSkillsDir?: string): ToolSyncReport {
  const resolvedToolDir = toolSkillsDir ?? tool.skillsDir;
  const skills: SkillSyncState[] = [];
  let healthyCount = 0;
  let brokenCount = 0;
  let copyCount = 0;
  let missingCount = 0;

  for (const skillName of hubSkillNames) {
    const state = checkSkillStatus(skillName, resolvedToolDir, hubPath, hubSkillNames);
    skills.push(state);

    switch (state.status) {
      case 'healthy':
        healthyCount++;
        break;
      case 'broken':
        brokenCount++;
        break;
      case 'copy':
        copyCount++;
        break;
      case 'missing':
        missingCount++;
        break;
    }
  }

  // Also check for tool-specific skills in hub
  const toolSpecificDir = path.join(hubPath, 'tools', tool.name);
  if (fs.existsSync(toolSpecificDir)) {
    const toolSpecificSkills = fs.readdirSync(toolSpecificDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name);

    for (const skillName of toolSpecificSkills) {
      if (!hubSkillNames.includes(skillName)) {
        const state = checkSkillStatus(skillName, resolvedToolDir, hubPath, [...hubSkillNames, skillName]);
        skills.push(state);
        switch (state.status) {
          case 'healthy': healthyCount++; break;
          case 'broken': brokenCount++; break;
          case 'copy': copyCount++; break;
          case 'missing': missingCount++; break;
        }
      }
    }
  }

  // Check for extra skills in tool directory not in hub
  if (fs.existsSync(resolvedToolDir)) {
    const toolSkills = fs.readdirSync(resolvedToolDir, { withFileTypes: true })
      .filter(d => (d.isDirectory() || d.isSymbolicLink()) && !d.name.startsWith('.'))
      .map(d => d.name);

    const allHubSkills = new Set([...hubSkillNames]);
    const toolSpecificDir2 = path.join(hubPath, 'tools', tool.name);
    if (fs.existsSync(toolSpecificDir2)) {
      const specificSkills = fs.readdirSync(toolSpecificDir2, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))
        .map(d => d.name);
      for (const s of specificSkills) allHubSkills.add(s);
    }

    for (const skillName of toolSkills) {
      if (!allHubSkills.has(skillName)) {
        const state = checkSingleSkillStatus(skillName, path.join(resolvedToolDir, skillName), undefined);
        skills.push(state);
        switch (state.status) {
          case 'healthy': healthyCount++; break;
          case 'broken': brokenCount++; break;
          case 'copy': copyCount++; break;
          case 'missing': missingCount++; break;
        }
      }
    }
  }

  return {
    tool,
    skills,
    healthyCount,
    brokenCount,
    copyCount,
    missingCount,
  };
}

export function generateReport(hubPath: string, tools: Tool[], globalSkills: string[], toolDirs?: Map<string, string>): SyncStatusReport {
  const reports: ToolSyncReport[] = [];
  let totalSkills = 0;
  let totalHealthy = 0;
  let totalBroken = 0;
  let totalCopy = 0;
  let totalMissing = 0;

  for (const tool of tools) {
    if (!tool.enabled) continue;

    const toolSkillsDir = toolDirs?.get(tool.name);
    const report = checkToolStatus(tool, hubPath, globalSkills, toolSkillsDir);
    reports.push(report);

    totalSkills += report.skills.length;
    totalHealthy += report.healthyCount;
    totalBroken += report.brokenCount;
    totalCopy += report.copyCount;
    totalMissing += report.missingCount;
  }

  return {
    hubPath,
    tools: reports,
    totalSkills,
    totalHealthy,
    totalBroken,
    totalCopy,
    totalMissing,
  };
}
