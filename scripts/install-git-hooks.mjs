// Points git at the versioned hooks in .githooks/ (runs on `npm install` via
// the `prepare` script). Does nothing outside a git checkout (e.g. Docker builds).
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
    stdio: 'ignore',
  });
} catch {
  process.exit(0);
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  stdio: 'inherit',
});
console.log('git hooks: core.hooksPath=.githooks (pre-commit runs gitleaks)');
