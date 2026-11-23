import { spawnSync } from 'node:child_process';

const npm = process.env.npm_execpath ?? 'npm';
const environment = { ...process.env };
delete environment.npm_config_allow_scripts;

const auditArgs = process.argv.includes('--full') ? [] : ['--omit=dev'];
const result = spawnSync(process.execPath, [npm, 'audit', ...auditArgs, '--ignore-scripts'], {
  env: environment,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
