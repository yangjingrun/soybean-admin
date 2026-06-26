# Module B - shared secret crypto

## References

- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- Node.js `crypto` documentation: https://nodejs.org/api/crypto.html
- Existing project pattern: `CrmGmailOAuthTokenProvider` already stores Gmail refresh tokens with AES-256-GCM and a 32-byte key.

## Scope

- Extract the already-used Gmail AES-256-GCM implementation into `apps/server/src/shared/secret-crypto.ts`.
- Keep Gmail-specific wrapper functions in the CRM module so existing callers and tests do not change business behavior.
- Add focused unit tests for plaintext hiding, tamper rejection, and 32-byte key validation.

## Non-scope

- Do not change AI/Serper/Hunter persistence fields in this step.
- Do not rotate existing secrets or change runtime environment variables in this step.

## Acceptance

- Gmail OAuth token encryption tests still pass.
- Shared secret crypto tests pass.
- Server typecheck passes.
