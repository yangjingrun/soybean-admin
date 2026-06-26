# AI Settings Database Design

## Background

This project will start with AI lead generation backed by server-side AI configuration, then gradually grow into a multi-tenant business system that may include CRM, email management, resale or renewal workflows, and software licensing.

The database design should support SaaS deployment for multiple customers on one server and private deployment for one customer. Private deployment still uses the same tenant model with one default tenant, so the codebase does not split into two data models.

Core AI prompts are platform assets. Customers and tenant users should only use business pages such as AI lead generation. They should not see prompt templates, prompt keys, feature keys, system prompt content, or prompt editing forms.

AI model credentials are tenant assets. Customers bring their own model API keys, so tenant administrators need a model settings page where they can configure provider, API base, API key, model name, and default generation parameters. The system should store API keys encrypted and return only masked key metadata to the frontend.

## Goals

- Add a PostgreSQL and Prisma based database foundation for server-side AI settings.
- Keep the first implementation focused on AI lead generation and hidden platform prompts.
- Reserve clear tenant and user boundaries for future CRM, email, resale, and license modules.
- Make platform AI prompts versioned, auditable, and safe to update later.
- Allow AI business pages to call server-side built-in prompts without exposing system prompts.
- Let tenant administrators configure their own model API credentials without seeing platform prompts.

## Non-Goals

- Do not implement CRM tables in the first phase.
- Do not implement email account, campaign, or mailbox tables in the first phase.
- Do not implement software license tables in the first phase.
- Do not build a full dynamic permission system in the first phase.
- Do not let tenant users view or edit AI prompt content.
- Do not let platform prompts depend on tenant-owned prompt content.
- Do not keep Redis as the long-term storage for AI prompts and model settings.

## Recommended Stack

- Database: PostgreSQL
- ORM and migration: Prisma
- Backend integration: NestJS `DatabaseModule` with a shared `PrismaService`
- Schema location: `prisma/schema.prisma`
- Migration location: `prisma/migrations`

PostgreSQL is selected because the long-term product has many relational workflows: tenants, users, roles, customers, contacts, mail records, license records, orders, follow-ups, and AI analysis logs. Prisma is selected because the schema is explicit, migrations are easy to review, and generated TypeScript types fit the existing NestJS backend.

## Phase 1 Scope

Phase 1 should create the database foundation and the hidden AI settings loop:

- Tenants
- Users
- Roles
- User roles
- Tenant AI model configs
- Platform AI prompt templates
- Platform AI prompt versions
- Platform AI features
- Tenant AI feature settings
- AI generation logs

Only the platform hidden prompt settings, tenant model settings, and AI gateway behavior should use these AI configuration tables in phase 1. Future CRM, email, resale, and licensing modules should be documented but not created as migrations yet.

## Tenant Model

Every customer business table should carry `tenant_id` unless it is a platform-level global table. Core AI prompts are platform-level global tables because they are product assets owned by the platform operator. Model API credentials are tenant-level tables because customers supply their own API keys.

For SaaS deployment:

- One server can host multiple tenants.
- Tenant data is separated by `tenant_id`.
- Platform AI prompts are shared product assets and are not copied per tenant.
- Tenant AI model configs are separated by `tenant_id`.
- Platform administrators can manage tenants and subscriptions later.

For private deployment:

- The system creates one default tenant.
- Customer business data still uses `tenant_id`.
- If core prompts must remain protected, private deployments should call a platform-controlled AI gateway instead of storing prompt content on the customer server.
- No separate private-deployment business schema is needed.

## Base Tables

### tenants

Stores customer companies or deployment units.

| Column     | Type         | Required | Notes               |
| ---------- | ------------ | -------- | ------------------- |
| id         | uuid         | yes      | Primary key         |
| name       | varchar(120) | yes      | Tenant display name |
| code       | varchar(60)  | yes      | Stable tenant code  |
| status     | varchar(30)  | yes      | active, disabled    |
| created_at | timestamptz  | yes      | Created time        |
| updated_at | timestamptz  | yes      | Updated time        |

Constraints:

- Unique `code`

### users

Stores backend users. Existing demo users should eventually move into this table.

| Column        | Type         | Required | Notes            |
| ------------- | ------------ | -------- | ---------------- |
| id            | uuid         | yes      | Primary key      |
| tenant_id     | uuid         | yes      | Tenant owner     |
| user_name     | varchar(80)  | yes      | Login name       |
| password_hash | varchar(255) | yes      | Password hash    |
| display_name  | varchar(120) | no       | Display name     |
| status        | varchar(30)  | yes      | active, disabled |
| created_at    | timestamptz  | yes      | Created time     |
| updated_at    | timestamptz  | yes      | Updated time     |

Constraints:

- Unique `tenant_id, user_name`

### roles

Stores tenant-level roles. A platform-level super admin can be represented by a reserved tenant or a platform flag during implementation.

| Column     | Type         | Required | Notes                    |
| ---------- | ------------ | -------- | ------------------------ |
| id         | uuid         | yes      | Primary key              |
| tenant_id  | uuid         | yes      | Tenant owner             |
| role_key   | varchar(60)  | yes      | R_SUPER, R_ADMIN, R_USER |
| name       | varchar(100) | yes      | Role display name        |
| created_at | timestamptz  | yes      | Created time             |
| updated_at | timestamptz  | yes      | Updated time             |

Constraints:

- Unique `tenant_id, role_key`

### user_roles

Connects users and roles.

| Column     | Type        | Required | Notes        |
| ---------- | ----------- | -------- | ------------ |
| user_id    | uuid        | yes      | User id      |
| role_id    | uuid        | yes      | Role id      |
| created_at | timestamptz | yes      | Created time |

Constraints:

- Primary key `user_id, role_id`

## AI Settings Tables

### tenant_ai_model_configs

Stores customer-owned AI model channels such as OpenRouter, DeepSeek, OpenAI-compatible providers, and custom provider endpoints. Tenant administrators can manage these settings, but API keys should be stored encrypted and returned to the frontend only as masked metadata.

| Column            | Type         | Required | Notes                                |
| ----------------- | ------------ | -------- | ------------------------------------ |
| id                | uuid         | yes      | Primary key                          |
| tenant_id         | uuid         | yes      | Tenant owner                         |
| name              | varchar(100) | yes      | Tenant display name                  |
| provider          | varchar(50)  | yes      | openai, deepseek, openrouter, custom |
| api_base          | varchar(255) | yes      | Provider base URL                    |
| api_key_encrypted | text         | yes      | Encrypted API key                    |
| model             | varchar(120) | yes      | Model name                           |
| temperature       | numeric(3,2) | no       | Default temperature                  |
| max_tokens        | int          | no       | Default output token limit           |
| api_key_mask      | varchar(80)  | no       | Masked key shown to tenant admin     |
| is_default        | boolean      | yes      | Default model in tenant              |
| is_enabled        | boolean      | yes      | Whether available to tenant features |
| created_by        | uuid         | no       | Tenant admin user id                 |
| updated_by        | uuid         | no       | Tenant admin user id                 |
| created_at        | timestamptz  | yes      | Created time                         |
| updated_at        | timestamptz  | yes      | Updated time                         |

Constraints:

- Unique `tenant_id, name`
- Business rule: only one enabled default model per tenant

Indexes:

- `tenant_id, is_enabled`
- `tenant_id, is_default`

### platform_ai_prompt_templates

Stores stable hidden prompt identities such as lead generation, email crafting, and lead matching. These are internal product configuration records, not customer-facing settings.

| Column             | Type         | Required | Notes                                                          |
| ------------------ | ------------ | -------- | -------------------------------------------------------------- |
| id                 | uuid         | yes      | Primary key                                                    |
| prompt_key         | varchar(60)  | yes      | lead_keyword_optimize, lead_match_analyze, lead_email_generate |
| name               | varchar(100) | yes      | Internal display name                                          |
| description        | text         | no       | Internal usage description                                     |
| current_version_id | uuid         | no       | Active version                                                 |
| is_enabled         | boolean      | yes      | Whether available to features                                  |
| created_by         | uuid         | no       | Platform admin user id                                         |
| updated_by         | uuid         | no       | Platform admin user id                                         |
| created_at         | timestamptz  | yes      | Created time                                                   |
| updated_at         | timestamptz  | yes      | Updated time                                                   |

Constraints:

- Unique `prompt_key`

Indexes:

- `is_enabled`

### platform_ai_prompt_versions

Stores immutable hidden prompt content versions. Updating prompt content creates a new version instead of overwriting the old one.

| Column        | Type         | Required | Notes                        |
| ------------- | ------------ | -------- | ---------------------------- |
| id            | uuid         | yes      | Primary key                  |
| template_id   | uuid         | yes      | Platform prompt template id  |
| version_no    | int          | yes      | 1, 2, 3...                   |
| system_prompt | text         | yes      | Hidden system prompt content |
| output_schema | jsonb        | no       | Expected JSON output shape   |
| change_note   | varchar(255) | no       | Why this version changed     |
| created_by    | uuid         | no       | Platform admin user id       |
| created_at    | timestamptz  | yes      | Created time                 |

Constraints:

- Unique `template_id, version_no`

Indexes:

- `template_id, created_at`

### platform_ai_features

Binds an internal product feature to one platform prompt template. Business pages call feature-specific backend APIs instead of directly choosing prompts, prompt keys, or feature keys.

| Column              | Type         | Required | Notes                       |
| ------------------- | ------------ | -------- | --------------------------- |
| id                  | uuid         | yes      | Primary key                 |
| feature_key         | varchar(80)  | yes      | ai_leads_generate           |
| name                | varchar(100) | yes      | Internal display name       |
| prompt_template_id  | uuid         | yes      | Platform prompt template id |
| default_temperature | numeric(3,2) | no       | Platform default            |
| default_max_tokens  | int          | no       | Platform default            |
| is_enabled          | boolean      | yes      | Whether callable            |
| created_by          | uuid         | no       | Platform admin user id      |
| updated_by          | uuid         | no       | Platform admin user id      |
| created_at          | timestamptz  | yes      | Created time                |
| updated_at          | timestamptz  | yes      | Updated time                |

Constraints:

- Unique `feature_key`

Indexes:

- `is_enabled`

### tenant_ai_feature_settings

Stores per-tenant runtime settings for platform AI features. Tenant administrators can enable a feature and choose which tenant-owned model config it uses, but they cannot see the platform prompt behind the feature.

| Column          | Type         | Required | Notes                                |
| --------------- | ------------ | -------- | ------------------------------------ |
| id              | uuid         | yes      | Primary key                          |
| tenant_id       | uuid         | yes      | Tenant owner                         |
| feature_id      | uuid         | yes      | Platform feature id                  |
| model_config_id | uuid         | yes      | Tenant model config id               |
| temperature     | numeric(3,2) | no       | Tenant override                      |
| max_tokens      | int          | no       | Tenant override                      |
| is_enabled      | boolean      | yes      | Whether tenant can call this feature |
| created_by      | uuid         | no       | Tenant admin user id                 |
| updated_by      | uuid         | no       | Tenant admin user id                 |
| created_at      | timestamptz  | yes      | Created time                         |
| updated_at      | timestamptz  | yes      | Updated time                         |

Constraints:

- Unique `tenant_id, feature_id`

Indexes:

- `tenant_id, is_enabled`

### ai_generation_logs

Stores AI call history for debugging, cost tracking, prompt evaluation, and later CRM traceability. This table belongs to a tenant because calls happen from tenant users and business data.

| Column            | Type        | Required | Notes                        |
| ----------------- | ----------- | -------- | ---------------------------- |
| id                | uuid        | yes      | Primary key                  |
| tenant_id         | uuid        | yes      | Tenant owner                 |
| feature_id        | uuid        | no       | Platform feature used        |
| prompt_version_id | uuid        | no       | Platform prompt version used |
| model_config_id   | uuid        | no       | Tenant model config used     |
| user_id           | uuid        | no       | Operator                     |
| input_text        | text        | yes      | User input                   |
| output_text       | text        | no       | Raw model output             |
| output_json       | jsonb       | no       | Parsed JSON output           |
| finish_reason     | varchar(50) | no       | Provider finish reason       |
| input_tokens      | int         | no       | Input token count            |
| output_tokens     | int         | no       | Output token count           |
| total_tokens      | int         | no       | Total token count            |
| error_message     | text        | no       | Error message if failed      |
| created_at        | timestamptz | yes      | Created time                 |

Indexes:

- `tenant_id, created_at`
- `tenant_id, feature_id, created_at`
- `tenant_id, user_id, created_at`

## Relationship Summary

```text
tenants
  ├─ users
  │   └─ user_roles ─ roles
  ├─ tenant_ai_model_configs
  ├─ tenant_ai_feature_settings
  └─ ai_generation_logs
      ├─ platform_ai_features
      ├─ platform_ai_prompt_versions
      ├─ tenant_ai_model_configs
      └─ users

platform_ai_prompt_templates
  └─ platform_ai_prompt_versions

platform_ai_features
  └─ platform_ai_prompt_templates

tenant_ai_feature_settings
  ├─ platform_ai_features
  └─ tenant_ai_model_configs
```

## Permission Boundary

Phase 1 should keep permissions simple and explicit:

- Platform super admin can manage hidden AI prompts, prompt versions, and platform feature bindings.
- Tenant super admin cannot view or edit hidden AI prompts.
- Tenant super admin or tenant admin can manage tenant model configs and select which model a feature uses.
- Tenant admin can use AI business pages if allowed by route roles.
- Normal users can call enabled AI business pages but cannot read system prompts, prompt keys, feature keys, or raw API keys.

The platform hidden prompt settings page should require a platform-level super admin role. The tenant model settings page should require a tenant admin role. The AI lead generation page should call a business endpoint and should not expose the prompt editor, prompt key, feature key, or raw model API key.

## Backend Module Boundary

Recommended modules:

```text
apps/server/src/modules/database
  prisma.module.ts
  prisma.service.ts

apps/server/src/modules/ai-gateway
  ai-gateway.controller.ts
  ai-gateway.service.ts
  ai-settings.repository.ts
  dto/
```

The controller should handle request DTOs and response shape. The service should handle business rules, such as activating a prompt version or resolving a feature. The repository should encapsulate Prisma queries.

## AI Call Flow

1. Frontend calls a business endpoint such as `POST /ai-gateway/ai-leads/generate`.
2. Backend resolves tenant and user from auth context.
3. Backend maps this endpoint to the internal platform feature key.
4. Backend loads the enabled platform feature.
5. Backend loads the tenant feature setting for the current tenant.
6. Backend loads the tenant-owned model config selected by that setting.
7. Backend loads the platform prompt template current version.
8. Backend calls the model provider with the tenant API key.
9. Backend writes `ai_generation_logs`.
10. Backend returns the generated result.

This flow keeps prompt names, prompt keys, prompt content, and platform feature bindings server-side. Tenant admins can manage model credentials, but regular business users should not receive raw API keys.

## Customer-Facing Behavior

Tenant users see business pages, not AI configuration internals.

For example, on the AI lead generation page:

1. The user enters a sourcing requirement.
2. The frontend sends only the requirement to the backend.
3. The backend internally applies the hidden lead generation prompt.
4. The backend returns keywords, customer profile, search strategy, and other generated output.

The frontend must not show a prompt selector, prompt editor, model selector, or workflow selector for tenant users.

Tenant administrators can see a separate model settings page:

1. They add their own OpenAI-compatible provider, API base, API key, model, and parameters.
2. They choose which model config is used by AI lead generation.
3. They can see whether an API key exists through a masked value, but the backend should not return the raw key after saving.
4. They still cannot see the hidden prompt that the AI lead generation feature uses.

## Future Modules Reserved

The following modules are intentionally not implemented in phase 1, but they should attach to the same tenant and user model later:

- CRM: customers, contacts, leads, follow-ups, tags, stages, sources
- Email: mailboxes, email templates, send logs, reply logs, campaign records
- Resale: orders, products, renewal opportunities, follow-up plans, after-sale records
- Licensing: plans, tenant subscriptions, licenses, license activations, device bindings

AI logs can later reference CRM entities, such as `lead_id`, `customer_id`, or `email_id`, through new nullable relation columns or a separate AI object relation table when the module exists.

## Implementation Notes

- Use migrations. Do not rely on schema synchronization.
- Encrypt API keys before storing them.
- Do not return `api_key_encrypted` to the frontend.
- Prefer generated Prisma types in backend repositories.
- Keep tenant filtering in repository methods for tenant-owned data so business code does not forget tenant boundaries.
- Seed one default tenant, one platform super user, one hidden `lead_keyword_optimize` prompt template, one prompt version, one AI lead generation feature binding, and one tenant model config placeholder for local testing.
- Use Node.js `crypto.scrypt` for password hashing in phase 1, avoiding an extra password library dependency.
- Use Node.js `crypto` AES-256-GCM for AI provider API key encryption.
- Store encryption secrets in environment variables, not in source code or database rows.
- Keep platform-level tenant management out of phase 1. The schema keeps enough tenant boundaries for it to be added later.
- Do not create frontend APIs that return `system_prompt`, `prompt_key`, or `feature_key` to tenant users.
- Do not return raw or encrypted API keys to the frontend. Tenant admin APIs may return `api_key_mask`.
