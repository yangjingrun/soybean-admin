/** Parses one decoded NDJSON chunk and returns the unfinished trailing buffer. */
export function parseLeadSearchStreamChunk(
  buffer: string,
  chunk: string,
  onEvent: (event: Api.AiLeads.LeadSearchProgressEvent) => void
) {
  const lines = `${buffer}${chunk}`.split(/\r?\n/);
  const nextBuffer = lines.pop() ?? '';

  for (const line of lines) {
    parseLeadSearchStreamLine(line, onEvent);
  }

  return nextBuffer;
}

/** Parses the final buffered NDJSON line after the stream closes. */
export function flushLeadSearchStreamBuffer(
  buffer: string,
  onEvent: (event: Api.AiLeads.LeadSearchProgressEvent) => void
) {
  parseLeadSearchStreamLine(buffer, onEvent);
}

function parseLeadSearchStreamLine(line: string, onEvent: (event: Api.AiLeads.LeadSearchProgressEvent) => void) {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return;
  }

  onEvent(JSON.parse(trimmedLine) as Api.AiLeads.LeadSearchProgressEvent);
}
