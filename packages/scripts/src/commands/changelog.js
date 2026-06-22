import { generateChangelog, generateTotalChangelog } from '@soybeanjs/changelog';
export async function genChangelog(options, total = false) {
  if (total) {
    await generateTotalChangelog(options);
  } else {
    await generateChangelog(options);
  }
}
