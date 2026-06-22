import path from 'node:path';
import { readFileSync } from 'node:fs';
import { prompt } from 'enquirer';
import { execCommand } from '../shared';
import { locales } from '../locales';
/**
 * Git commit with Conventional Commits standard
 *
 * @param lang
 */
export async function gitCommit(lang = 'en-us') {
  const { gitCommitMessages, gitCommitNoStaged, gitCommitTypes, gitCommitScopes } = locales[lang];
  const stagedFiles = await execCommand('git', ['diff', '--cached', '--name-only']);
  if (!stagedFiles) {
    console.error(gitCommitNoStaged);
    process.exit(1);
  }
  const typesChoices = gitCommitTypes.map(([value, msg]) => {
    const nameWithSuffix = `${value}:`;
    const message = `${nameWithSuffix.padEnd(12)}${msg}`;
    return {
      name: value,
      message
    };
  });
  const scopesChoices = gitCommitScopes.map(([value, msg]) => ({
    name: value,
    message: `${value.padEnd(30)} (${msg})`
  }));
  // Suppress ERR_USE_AFTER_CLOSE thrown by enquirer's readline cleanup on Ctrl+C (Node.js v24+)
  const errorHandler = error => {
    if (error.code === 'ERR_USE_AFTER_CLOSE') {
      process.exit(0);
    }
  };
  process.on('uncaughtException', errorHandler);
  let result;
  try {
    result = await prompt([
      {
        name: 'types',
        type: 'select',
        message: gitCommitMessages.types,
        choices: typesChoices
      },
      {
        name: 'scopes',
        type: 'select',
        message: gitCommitMessages.scopes,
        choices: scopesChoices
      },
      {
        name: 'description',
        type: 'text',
        message: gitCommitMessages.description
      }
    ]);
  } catch {
    process.exit(0);
  } finally {
    process.off('uncaughtException', errorHandler);
  }
  const breaking = result.description.startsWith('!') ? '!' : '';
  const description = result.description.replace(/^!/, '').trim();
  const commitMsg = `${result.types}(${result.scopes})${breaking}: ${description}`;
  await execCommand('git', ['commit', '-m', commitMsg], { stdio: 'inherit' });
}
/** Git commit message verify */
export async function gitCommitVerify(lang = 'en-us', ignores = []) {
  const gitPath = await execCommand('git', ['rev-parse', '--show-toplevel']);
  const gitMsgPath = path.join(gitPath, '.git', 'COMMIT_EDITMSG');
  const commitMsg = readFileSync(gitMsgPath, 'utf8').trim();
  if (ignores.some(regExp => regExp.test(commitMsg))) return;
  const REG_EXP = /(?<type>[a-z]+)(?:\((?<scope>.+)\))?(?<breaking>!)?: (?<description>.+)/i;
  if (!REG_EXP.test(commitMsg)) {
    const errorMsg = locales[lang].gitCommitVerify;
    throw new Error(errorMsg);
  }
}
