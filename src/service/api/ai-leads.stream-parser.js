/** Parses one decoded NDJSON chunk and returns the unfinished trailing buffer. */
export function parseLeadSearchStreamChunk(buffer, chunk, onEvent) {
  const lines = `${buffer}${chunk}`.split(/\r?\n/);
  const nextBuffer = lines.pop() ?? '';
  for (const line of lines) {
    parseLeadSearchStreamLine(line, onEvent);
  }
  return nextBuffer;
}
/** Parses the final buffered NDJSON line after the stream closes. */
export function flushLeadSearchStreamBuffer(buffer, onEvent) {
  parseLeadSearchStreamLine(buffer, onEvent);
}
function parseLeadSearchStreamLine(line, onEvent) {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return;
  }
  onEvent(JSON.parse(trimmedLine));
}
