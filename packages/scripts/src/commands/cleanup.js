import { rimraf } from 'rimraf';
export async function cleanup(paths) {
  await rimraf(paths, { glob: true });
}
