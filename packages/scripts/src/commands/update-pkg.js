import { execCommand } from '../shared';
export async function updatePkg(args = ['--deep', '-u']) {
  execCommand('npx', ['npm-check-updates', ...args], { stdio: 'inherit' });
}
