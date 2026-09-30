// Builds the site and copies dist/ to the server with rsync over SSH.
//
//   npm run deploy               build and upload
//   npm run deploy -- --dry-run  build and show what would change, without uploading
//
// The target (user@host:path/) comes from DEPLOY_TARGET, set in the environment or in a
// git-ignored .env file (see .env.example), so no server address is ever committed.
//
// The upload runs in two passes so a visitor never sees a half-updated site: first the new
// hashed files (JS, CSS, images) without deleting anything, then the pages, sw.js and the
// manifest that point to them, and only then are files from old builds deleted.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ENTRY_FILES = ['*.html', 'sw.js', 'manifest.webmanifest'];

const dryRun = process.argv.includes('--dry-run');
const target = process.env.DEPLOY_TARGET?.trim();

if (!target) {
  console.error(
    'DEPLOY_TARGET is not set.\n' +
      'Copy .env.example to .env and set it to the server folder, for example:\n' +
      '  DEPLOY_TARGET=user@example.com:/var/www/karttakoulu/',
  );
  process.exit(1);
}

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npm', ['run', 'build']);

const rsync = ['-rtvz', '--checksum', ...(dryRun ? ['--dry-run'] : [])];
run('rsync', [...rsync, ...ENTRY_FILES.map((f) => `--exclude=${f}`), 'dist/', target]);
run('rsync', [...rsync, '--delete', 'dist/', target]);

const version = readFileSync('dist/sw.js', 'utf8').match(/const VERSIO = '([^']*)';/)?.[1];
console.log(
  `\n${dryRun ? 'Dry run done, nothing was uploaded' : 'Deployed'}: ${version} → ${target}`,
);
