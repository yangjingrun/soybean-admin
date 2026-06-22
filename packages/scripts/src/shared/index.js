export async function execCommand(cmd, args, options) {
  const { execa } = await import('execa');
  const res = await execa(cmd, args, options);
  return res?.stdout?.trim() || '';
}
