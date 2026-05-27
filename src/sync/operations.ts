/**
 * File system operations for skill synchronization
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export function createSymlink(linkPath: string, targetPath: string): void {
  const parent = path.dirname(linkPath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  // Remove existing file/directory/symlink at linkPath
  if (fs.existsSync(linkPath) || isBrokenSymlink(linkPath)) {
    fs.rmSync(linkPath, { recursive: true, force: true });
  }
  fs.symlinkSync(targetPath, linkPath, 'dir');
}

function isBrokenSymlink(linkPath: string): boolean {
  try {
    return fs.lstatSync(linkPath).isSymbolicLink();
  } catch {
    return false;
  }
}

export function removeSymlink(linkPath: string): void {
  if (fs.existsSync(linkPath) && fs.lstatSync(linkPath).isSymbolicLink()) {
    fs.unlinkSync(linkPath);
  }
}

export function createCopy(destPath: string, sourcePath: string): void {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source does not exist: ${sourcePath}`);
  }

  const parent = path.dirname(destPath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }

  // Remove existing destination
  if (fs.existsSync(destPath) || isBrokenSymlink(destPath)) {
    fs.rmSync(destPath, { recursive: true, force: true });
  }

  function copyRecursive(src: string, dst: string): void {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      if (!fs.existsSync(dst)) {
        fs.mkdirSync(dst, { recursive: true });
      }
      const entries = fs.readdirSync(src);
      for (const entry of entries) {
        copyRecursive(path.join(src, entry), path.join(dst, entry));
      }
    } else {
      fs.copyFileSync(src, dst);
    }
  }

  copyRecursive(sourcePath, destPath);
}

export function removeCopy(destPath: string): void {
  if (fs.existsSync(destPath)) {
    fs.rmSync(destPath, { recursive: true, force: true });
  }
}

export function isSymlinkBroken(linkPath: string): boolean {
  let isLink = false;
  try {
    isLink = fs.lstatSync(linkPath).isSymbolicLink();
  } catch {
    return false;
  }

  if (!isLink) return false;

  try {
    fs.statSync(linkPath);
    return false;
  } catch {
    return true;
  }
}

export function readSymlinkTarget(linkPath: string): string | null {
  if (!fs.existsSync(linkPath)) return null;
  if (!fs.lstatSync(linkPath).isSymbolicLink()) return null;
  return fs.readlinkSync(linkPath);
}
