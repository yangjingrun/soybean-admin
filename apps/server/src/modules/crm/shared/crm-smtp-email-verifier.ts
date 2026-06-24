import { Socket, createConnection } from 'node:net';
import type { CrmEmailStatus, CrmEmailVerificationReason } from '../crm.types';
import type { CrmEmailMxRecord } from './crm-email-utils';

const smtpPort = 25;
const smtpTimeoutMs = 8000;
const smtpHeloName = 'soybean-admin.local';

export interface CrmEmailSmtpVerificationInput {
  email: string;
  mxRecords: CrmEmailMxRecord[];
}

export interface CrmEmailSmtpVerificationResult {
  status: Extract<CrmEmailStatus, 'valid' | 'invalid' | 'unreachable'>;
  reason: Extract<
    CrmEmailVerificationReason,
    'smtp_recipient_accepted' | 'smtp_recipient_rejected' | 'smtp_temporary_failure'
  >;
}

export interface CrmEmailSmtpVerifier {
  verifyRecipient(input: CrmEmailSmtpVerificationInput): Promise<CrmEmailSmtpVerificationResult>;
}

/** Performs a lightweight SMTP RCPT probe without sending message content. */
export class CrmSmtpEmailVerifier implements CrmEmailSmtpVerifier {
  async verifyRecipient(input: CrmEmailSmtpVerificationInput): Promise<CrmEmailSmtpVerificationResult> {
    const mxRecords = normalizeMxRecords(input.mxRecords);

    for (const record of mxRecords) {
      const result = await this.probeMx(record.exchange, input.email);

      if (result.status !== 'unreachable') {
        return result;
      }
    }

    return {
      status: 'unreachable',
      reason: 'smtp_temporary_failure'
    };
  }

  private async probeMx(host: string, email: string): Promise<CrmEmailSmtpVerificationResult> {
    const session = new SmtpProbeSession(host, smtpPort, smtpTimeoutMs);

    try {
      await session.connect();
      const banner = await session.readResponse();

      if (!isPositiveSmtpCode(banner.code)) {
        return toSmtpTemporaryFailure();
      }

      const helo = await session.command(`EHLO ${smtpHeloName}`);

      if (!isPositiveSmtpCode(helo.code)) {
        return toSmtpTemporaryFailure();
      }

      const sender = await session.command('MAIL FROM:<>');

      if (!isPositiveSmtpCode(sender.code)) {
        return toSmtpTemporaryFailure();
      }

      const recipient = await session.command(`RCPT TO:<${email}>`);

      if (isPositiveSmtpCode(recipient.code)) {
        return {
          status: 'valid',
          reason: 'smtp_recipient_accepted'
        };
      }

      if (isPermanentSmtpCode(recipient.code)) {
        return {
          status: 'invalid',
          reason: 'smtp_recipient_rejected'
        };
      }

      return toSmtpTemporaryFailure();
    } catch {
      return toSmtpTemporaryFailure();
    } finally {
      session.close();
    }
  }
}

interface SmtpResponse {
  code: number;
}

class SmtpProbeSession {
  private readonly socket: Socket;
  private buffer = '';
  private pendingReaders: Array<{
    resolve: (response: SmtpResponse) => void;
    reject: (error: Error) => void;
    lines: string[];
    timer: NodeJS.Timeout;
  }> = [];

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs: number
  ) {
    this.socket = createConnection({ host, port });
    this.socket.setTimeout(timeoutMs);
    this.socket.on('data', chunk => this.handleData(chunk.toString('utf8')));
    this.socket.on('error', error => this.rejectPending(error));
    this.socket.on('timeout', () => this.rejectPending(new Error('SMTP probe timed out')));
  }

  connect() {
    return new Promise<void>((resolve, reject) => {
      this.socket.once('connect', () => resolve());
      this.socket.once('error', reject);
    });
  }

  async command(value: string) {
    this.socket.write(`${value}\r\n`);

    return this.readResponse();
  }

  readResponse() {
    return new Promise<SmtpResponse>((resolve, reject) => {
      const reader = {
        resolve,
        reject,
        lines: [] as string[],
        timer: setTimeout(() => {
          this.removeReader(reader);
          reject(new Error('SMTP response timed out'));
        }, this.timeoutMs)
      };

      this.pendingReaders.push(reader);
      this.flushLines();
    });
  }

  close() {
    if (!this.socket.destroyed) {
      this.socket.write('QUIT\r\n');
      this.socket.destroy();
    }
  }

  private handleData(data: string) {
    this.buffer += data;
    this.flushLines();
  }

  private flushLines() {
    while (this.pendingReaders.length > 0) {
      const lineEndIndex = this.buffer.indexOf('\n');

      if (lineEndIndex < 0) {
        return;
      }

      const line = this.buffer.slice(0, lineEndIndex).replace(/\r$/, '');
      this.buffer = this.buffer.slice(lineEndIndex + 1);

      const reader = this.pendingReaders[0];
      reader.lines.push(line);

      if (!isLastSmtpResponseLine(line)) {
        continue;
      }

      this.pendingReaders.shift();
      clearTimeout(reader.timer);
      reader.resolve({ code: parseSmtpCode(reader.lines.at(-1) ?? '') });
    }
  }

  private rejectPending(error: Error) {
    while (this.pendingReaders.length > 0) {
      const reader = this.pendingReaders.shift();

      if (!reader) {
        continue;
      }

      clearTimeout(reader.timer);
      reader.reject(error);
    }
  }

  private removeReader(reader: (typeof this.pendingReaders)[number]) {
    this.pendingReaders = this.pendingReaders.filter(item => item !== reader);
  }
}

function normalizeMxRecords(records: CrmEmailMxRecord[]) {
  return records
    .filter(record => record.exchange)
    .toSorted((left, right) => left.priority - right.priority);
}

function isLastSmtpResponseLine(line: string) {
  return /^\d{3}(?:\s|$)/.test(line);
}

function parseSmtpCode(line: string) {
  const code = Number(line.slice(0, 3));

  return Number.isInteger(code) ? code : 0;
}

function isPositiveSmtpCode(code: number) {
  return code >= 200 && code < 300;
}

function isPermanentSmtpCode(code: number) {
  return code >= 500 && code < 600;
}

function toSmtpTemporaryFailure(): CrmEmailSmtpVerificationResult {
  return {
    status: 'unreachable',
    reason: 'smtp_temporary_failure'
  };
}
