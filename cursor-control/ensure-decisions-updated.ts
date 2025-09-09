#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { statSync } from 'fs';

function hasRecentDecisionsUpdate(): boolean {
  try {
    const lastCommit = execSync('git log -1 --name-only --pretty=format:', { encoding: 'utf-8' });
    if (lastCommit.includes('DECISIONS.md')) return true;
    const stats = statSync('DECISIONS.md');
    const mtime = new Date(stats.mtime);
    const ageHours = (Date.now() - mtime.getTime()) / (1000 * 60 * 60);
    return ageHours < 24;
  } catch (e) {
    return false;
  }
}

function main() {
  try {
    const diff = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    const files = diff.split('\n').filter(Boolean);
    const codeChanges = files.some(f =>
      f.startsWith('app') || f.startsWith('src') || f.startsWith('server') || f.startsWith('packages') || f.startsWith('workers')
    );
    if (codeChanges && !hasRecentDecisionsUpdate()) {
      console.error('\n[ERROR] Code changes detected but DECISIONS.md not updated in last 24h.\n');
      console.error('Please append a log entry before committing. Use --no-verify to bypass if urgent.\n');
      process.exit(1);
    }
  } catch (err) {
    // fail open if git not available
  }
}

main();
