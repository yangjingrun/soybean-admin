# Module B - AI config encrypted persistence

## References

- OWASP Cryptographic Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- Prisma expand and contract migration workflow: https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations
- Local mature pattern: `apps/server/src/shared/secret-crypto.ts` and Gmail OAuth token encryption.

## Scope

- Add nullable `encryptedApiKey` columns for AI model, Serper, and Hunter configs.
- Store new provider keys through the shared AES-256-GCM helper.
- Keep legacy `apiKey` readable during the migration window, then clear it when a config is saved again.
- Read the encryption key from `AI_CONFIG_SECRET_ENCRYPTION_KEY`.

## Risk Review

- Global impact: AI text generation, Serper search, and Hunter enrichment all read these stores.
- Migration safety: this uses Prisma's expand and contract pattern. The old `apiKey` column remains for legacy rows; the new code writes `encryptedApiKey`.
- Deployment requirement: saving or reading encrypted rows requires a 32-byte `AI_CONFIG_SECRET_ENCRYPTION_KEY`.

## Follow-up

- After production rows are re-saved or backfilled, remove the legacy plaintext `apiKey` columns in a contract migration.
