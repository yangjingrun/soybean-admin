# AI Leads Structured Requirement Design

## Background

The current AI leads page is a single textarea plus a raw keyword optimization result. For foreign trade users, this is too loose: they need to confirm product details, target markets, customer types, selling points, and search directions before moving into lead matching.

This redesign keeps the existing backend capability: `POST /ai-leads/keyword-optimize`. The page will use that step to turn a natural-language requirement into a structured, editable acquisition brief. The user can review missing fields, fill gaps, and then prepare for the later lead matching step.

## Goals

- Turn the page from a raw text generation tool into a foreign-trade acquisition brief review page.
- Keep implementation scoped to the current keyword optimization API.
- Let users paste a rough requirement and get structured fields automatically filled.
- Make missing or uncertain requirement fields visible so users can check and supplement them.
- Expose the next workflow position, `下一步：线索匹配`, without implementing fake lead matching.

## Non-Goals

- Do not add a new backend endpoint in this phase.
- Do not implement real lead search, scraping, matching, CRM storage, or outreach generation.
- Do not show the raw AI result as the primary output.
- Do not add extra result actions beyond `重新分析` and `下一步：线索匹配`.
- Do not introduce a new UI framework or broad visual redesign.

## User Flow

1. User opens `AI获客`.
2. User enters a natural-language acquisition requirement, such as product, market, target customer, and selling points.
3. User clicks the primary analysis action.
4. Frontend sends a structured-output prompt through the existing keyword optimization API.
5. The result area displays a structured requirement review form.
6. User checks auto-filled fields and fills missing fields.
7. User can click `重新分析` to run the current content again.
8. User sees `下一步：线索匹配` as a disabled next-step button for the future workflow.

## Page Structure

### Header And Workflow

The page should show a compact workflow indicator:

- `1 需求结构化`: active
- `2 线索匹配`: disabled
- `3 开发信生成`: disabled

This tells users the page is the first step of the AI leads workflow without implying later steps are already functional.

### Requirement Input

The top card keeps a natural-language textarea because foreign trade users often start from messy context. The copy should guide users to include:

- Product and model
- Target country or region
- Target customer type
- Product advantages
- Search or exclusion preferences

The initial example can remain close to the current bearing case.

### Structured Review Result

After analysis, the result area becomes an editable review panel. It should not display the raw AI text. The panel is grouped by business meaning:

#### Product Info

- Product category
- Main keywords or model numbers
- Specifications
- Application scenarios

#### Target Market

- Countries or regions
- Language preference
- Key cities, ports, or industrial areas

#### Customer Profile

- Customer types, such as importer, distributor, wholesaler, factory, repair service
- Business scale or channel preference
- Purchase intent clues

#### Selling Points

- Supply stability
- Price competitiveness
- Certification
- Inventory
- MOQ
- Customization capability

#### Search Strategy

- English keywords
- Synonyms
- Search phrases
- Exclusion words
- Suggested channels

#### Missing Items

The panel should highlight fields the AI could not confidently infer. Missing items are not an error; they are review prompts. Examples:

- `规格参数待补充`
- `客户规模待确认`
- `认证信息待补充`

## Frontend Data Shape

The frontend should define a page-local type for the structured result because it is only used by this page in the current phase.

```ts
interface StructuredLeadRequirement {
  product: {
    category: string;
    keywords: string[];
    specifications: string[];
    applications: string[];
  };
  market: {
    regions: string[];
    languages: string[];
    locations: string[];
  };
  customer: {
    types: string[];
    scale: string;
    intentSignals: string[];
  };
  sellingPoints: string[];
  searchStrategy: {
    keywords: string[];
    synonyms: string[];
    phrases: string[];
    excludeWords: string[];
    channels: string[];
  };
  missingItems: string[];
}
```

Keep this type near the page or a page module. Do not promote it to shared types until backend or multiple pages reuse it.

## AI Prompt Contract

The frontend should wrap the user's requirement with a clear instruction asking the existing keyword optimization step to output JSON only.

The prompt should ask for:

- `product`
- `market`
- `customer`
- `sellingPoints`
- `searchStrategy`
- `missingItems`

The implementation should parse the returned text as JSON. If the model returns invalid JSON, show a normal Naive UI error message and keep the current form state. Do not silently fall back to raw text display.

## Components And State

Keep the first implementation small:

- `src/views/ai-leads/index.vue`: page orchestration, API call, current analysis state.
- `src/views/ai-leads/modules/StructuredRequirementPanel.vue`: editable structured review panel.
- `src/views/ai-leads/modules/shared.ts`: page-local types, default value factory, prompt builder, JSON parser helpers.

Use props down and events up:

- Parent owns `structuredRequirement`.
- Panel edits through `v-model` because this is a true editable form object.

## Interactions

- Primary initial action: analyze current natural-language requirement.
- Result action: `重新分析`, reuses the current text and overwrites the structured result after success.
- Future action: `下一步：线索匹配`, disabled in this phase.
- Empty result state should explain that analysis will generate a requirement review form.
- Loading state should be visible on the analysis button and result area.

## Error Handling

- Empty requirement: disable analysis.
- API error: follow the existing request layer behavior.
- Invalid structured output: show a concise message such as `结构化结果不可用，请调整提示词后重试`.
- Do not add multi-layer fallbacks or raw-result recovery UI in this phase.

## Visual Design

Follow the current Soybean Admin and Naive UI style:

- Use `NCard`, `NForm`, `NInput`, `NTag`, `NSpace`, `NGrid`, `NButton`, and `NEmpty`.
- Keep a dense backend-tool layout rather than a marketing layout.
- Use small cards and compact form controls.
- Avoid nested decorative cards.
- Keep mobile layout stacked and desktop layout split into review sections.

## Validation

Do not run `npm run build`.

Recommended checks after implementation:

- Run targeted TypeScript or lint checks only if the touched code warrants it.
- Manually verify the page can parse a valid mocked JSON result.
- Manually verify invalid JSON shows an error instead of raw AI text.
