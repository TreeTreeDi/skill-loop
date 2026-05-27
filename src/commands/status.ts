/**
 * Status command - show sync status across all tools
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, expandPath } from '../config/loader.js';
import { generateReport } from '../sync/status.js';

export interface StatusOptions {
  hubPath: string;
  homeDir?: string;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const homeDir = options.homeDir ?? os.homedir();
  const configPath = path.join(options.hubPath, '.skills-sync.toml');
  const config = loadConfig(configPath);
  const hubPath = expandPath(config.hub.path, homeDir);

  const skillsDir = path.join(hubPath, 'skills');
  const globalSkills = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];

  // Build map of resolved tool directories
  const toolDirs = new Map<string, string>();
  for (const tool of config.tools) {
    toolDirs.set(tool.name, expandPath(tool.skillsDir, homeDir));
  }

  const report = generateReport(hubPath, config.tools, globalSkills, toolDirs);

  console.log(`Hub: ${report.hubPath}`);
  console.log('');

  let hasIssues = false;

  for (const toolReport of report.tools) {
    if (!toolReport.tool.enabled) {
      console.log(`${toolReport.tool.name}: disabled`);
      continue;
    }

    const parts: string[] = [];
    if (toolReport.healthyCount > 0) parts.push(`${toolReport.healthyCount} healthy`);
    if (toolReport.brokenCount > 0) parts.push(`${toolReport.brokenCount} broken`);
    if (toolReport.copyCount > 0) parts.push(`${toolReport.copyCount} copy`);
    if (toolReport.missingCount > 0) parts.push(`${toolReport.missingCount} missing`);

    console.log(`${toolReport.tool.name.padEnd(12)} ${parts.join(', ') || '0 skills'}`);

    for (const skill of toolReport.skills) {
      if (skill.status !== 'healthy') {
        hasIssues = true;
        const icon = skill.status === 'broken' ? '⚠' : skill.status === 'copy' ? '?' : '✗';
        console.log(`  ${icon} ${skill.skill.name}: ${skill.status}`);
      }
    }
  }

  if (hasIssues) {
    console.log('');
    console.log('Run `skills-sync sync` to fix issues.');
  }
}
