#!/usr/bin/env node
/**
 * skills-sync CLI entry point
 */

import { Command } from 'commander';
import * as path from 'node:path';
import * as os from 'node:os';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { statusCommand } from './commands/status.js';
import { addCommand } from './commands/add.js';
import { syncCommand } from './commands/sync.js';
import { onboardCommand } from './commands/onboard.js';
import { removeCommand } from './commands/remove.js';

const program = new Command();

program
  .name('skills-sync')
  .description('Sync AI agent skills across multiple tools')
  .version('0.0.1');

program
  .command('init')
  .description('Initialize skills hub')
  .option('-p, --hub-path <path>', 'Hub directory path', '~/skills-hub')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-a, --append', 'Append to existing hub')
  .action(async (options) => {
    await initCommand({
      hubPath: options.hubPath,
      yes: options.yes,
      append: options.append,
    });
  });

program
  .command('list')
  .description('List all skills in hub')
  .option('-p, --hub-path <path>', 'Hub directory path', '~/skills-hub')
  .action(async (options) => {
    await listCommand({ hubPath: options.hubPath });
  });

program
  .command('status')
  .description('Show sync status across all tools')
  .option('-p, --hub-path <path>', 'Hub directory path', '~/skills-hub')
  .action(async (options) => {
    await statusCommand({ hubPath: options.hubPath });
  });

program
  .command('add <path>')
  .description('Add a skill to hub and sync to tools')
  .option('-p, --hub-path <path>', 'Hub directory path', '~/skills-hub')
  .option('-s, --scope <scope>', 'Sync scope: global or comma-separated tool names')
  .option('-m, --mode <mode>', 'Sync mode: symlink or copy')
  .action(async (skillPath, options) => {
    const scope = options.scope
      ? options.scope === 'global'
        ? 'global'
        : options.scope.split(',').map((s: string) => s.trim())
      : undefined;
    await addCommand({
      hubPath: options.hubPath,
      skillPath,
      scope,
      mode: options.mode,
    });
  });

program
  .command('sync')
  .description('Synchronize hub state with all tools')
  .option('-p, --hub-path <path>', 'Hub directory path', '~/skills-hub')
  .option('-f, --fix', 'Fix broken symlinks')
  .action(async (options) => {
    await syncCommand({ hubPath: options.hubPath, fix: options.fix });
  });

program
  .command('onboard <tool> [skill]')
  .description('Adopt skills from a tool directory into hub')
  .option('-p, --hub-path <path>', 'Hub directory path', '~/skills-hub')
  .option('--global', 'Adopt as global skill')
  .action(async (toolName, skillName, options) => {
    await onboardCommand({
      hubPath: options.hubPath,
      toolName,
      skillName,
      scope: options.global ? 'global' : 'tool-specific',
    });
  });

program
  .command('remove <skill>')
  .description('Remove a skill from hub and all tools')
  .option('-p, --hub-path <path>', 'Hub directory path', '~/skills-hub')
  .action(async (skillName, options) => {
    await removeCommand({ hubPath: options.hubPath, skillName });
  });

// Global error handling
program.exitOverride();

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error && error.name === 'CommanderError') {
      process.exit(error.message.includes('outputHelp') ? 0 : 1);
    }
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
