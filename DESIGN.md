---
name: SoybeanAdmin Naive
description: Vue 3 admin product interface built on Naive UI, UnoCSS, and theme-driven layout tokens.
colors:
  primary: '#646cff'
  info: '#2080f0'
  success: '#52c41a'
  warning: '#faad14'
  error: '#f5222d'
  surface-container: '#ffffff'
  surface-layout: '#f7fafc'
  surface-inverted: '#001428'
  text-base: '#1f1f1f'
  dark-container: '#1c1c1c'
  dark-layout: '#121212'
  dark-text-base: '#e0e0e0'
typography:
  headline:
    fontFamily: "v-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '24px'
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: '0'
  title:
    fontFamily: "v-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '18px'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: '0'
  body:
    fontFamily: "v-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: '0'
  label:
    fontFamily: "v-sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '13px'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0'
rounded:
  control: '6px'
  card: '8px'
  panel: '12px'
  preset-max: '16px'
spacing:
  xs: '8px'
  sm: '12px'
  md: '16px'
  lg: '24px'
  xl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface-container}'
    rounded: '{rounded.control}'
    height: '34px'
    padding: '0 16px'
  button-quaternary:
    backgroundColor: 'transparent'
    textColor: '{colors.text-base}'
    rounded: '{rounded.control}'
    height: '34px'
    padding: '0 12px'
  card-wrapper:
    backgroundColor: '{colors.surface-container}'
    textColor: '{colors.text-base}'
    rounded: '{rounded.card}'
    padding: '16px'
  input-default:
    backgroundColor: '{colors.surface-container}'
    textColor: '{colors.text-base}'
    rounded: '{rounded.control}'
    height: '34px'
    padding: '0 12px'
---

# Design System: SoybeanAdmin Naive

## 1. Overview

**Creative North Star: "The Quiet Control Room"**

SoybeanAdmin Naive is a product interface for repeated operational work. Its visual system should feel calm, structured, and immediately familiar to people who live in admin tools: a restrained light layout, a clear indigo primary accent, soft neutral surfaces, and compact controls that let users scan records and act quickly.

The system is not a place for a separate custom UI kit. Naive UI is the default component language, and existing project wrappers such as `ButtonIcon`, `DarkModeContainer`, `SystemLogo`, `ExceptionBase`, and layout modules are the local vocabulary. New business components may compose these pieces, but they should not reinvent buttons, inputs, selects, tables, drawers, modals, notifications, tabs, or tooltips.

**Key Characteristics:**

- Restrained product density with 16px page rhythm and responsive Naive UI grids.
- Theme-driven color, radius, shadow, layout height, dark mode, grayscale mode, and color-weakness mode.
- Primary color used for current location, primary action, loading bar, and state emphasis, not decoration.
- Familiar admin shell: header, sider, breadcrumb, tab bar, content body, and optional footer.
- Short state-driven motion, mainly page transitions and control feedback.

## 2. Colors

The palette is restrained: white and pale layout surfaces carry most screens, while the primary indigo marks actions, selection, and focus.

### Primary

- **Soybean Indigo**: The primary action and active-state color. Use it for `NButton type="primary"`, active menus, links that need emphasis, loading progress, selected mixed menu states, and small route or section accents.

### Secondary

- **System Info Blue**: Informational feedback and helper states.
- **Operation Green**: Success feedback after saves, creates, imports, and completed actions.
- **Review Amber**: Warning, pending, and attention states.
- **Destructive Red**: Errors, failed validation, destructive actions, and critical API feedback.

### Neutral

- **Container White**: Card, header, drawer, modal, popover, and form surfaces.
- **Layout Mist**: App background and page content field.
- **Inverted Navy**: Optional inverted sider or dark navigation surface.
- **Base Ink**: Primary body text in light mode.
- **Dark Container**: Dark-mode card and control surface.
- **Dark Layout**: Dark-mode page background.
- **Dark Text Base**: Primary body text in dark mode.

### Named Rules

**The Token Ownership Rule.** Do not hard-code a new palette for a page. Use `themeStore.themeColor`, `themeStore.themeColors`, `themeVars`, Naive UI theme overrides, or the CSS variables generated from `src/theme/settings.ts`.

**The Accent Scarcity Rule.** Primary color should mark state or action. If more than 10 percent of a normal admin page is primary-colored, the page is probably decorating instead of guiding.

## 3. Typography

**Display Font:** Naive UI default sans stack with system fallbacks
**Body Font:** Naive UI default sans stack with system fallbacks
**Label/Mono Font:** No separate label or mono font is defined

**Character:** One practical sans-serif system carries the whole product. Hierarchy comes from weight, size, and placement, not from display fonts or exaggerated letter spacing.

### Hierarchy

- **Headline** (700, 24px, 1.3): Page or feature titles inside product surfaces, for example the AI Leads title.
- **Title** (600, 18px, 1.4): Card headings, login module headings, key panel titles, and compact section headers.
- **Body** (400, 14px, 1.6): Form helper copy, descriptions, table text, alert content, and default page text.
- **Label** (500, 13px, 1.4): Compact labels, metadata, small hints, and short secondary text. Do not use tracked uppercase labels as a default section pattern.

### Named Rules

**The Product Type Rule.** Do not use fluid hero typography in app pages. Admin UI uses fixed rem or px scales so labels, table rows, and controls stay predictable.

**The Readability Rule.** Body copy must stay at or above 4.5:1 contrast against its surface. Avoid pale gray text such as `#999` on tinted or low-contrast backgrounds unless contrast is verified.

## 4. Elevation

Depth is mostly structural, not decorative. The shell uses low, functional shadows for header, sider, and tab separation, while cards stay flat with a light `shadow-sm` utility through `card-wrapper`. Modals, drawers, popovers, and tooltips should use Naive UI elevation instead of custom layered effects.

### Shadow Vocabulary

- **Header Separation** (`0 1px 2px rgb(0, 21, 41, 0.08)`): Fixed header boundary.
- **Sider Separation** (`2px 0 8px 0 rgb(29, 35, 41, 0.05)`): Sider boundary against the content field.
- **Tab Separation** (`0 1px 2px rgb(0, 21, 41, 0.08)`): Tab bar boundary.
- **Card Wrapper** (`shadow-sm`): Low surface lift for dashboard and workbench cards.

### Named Rules

**The Flat-By-Default Rule.** Cards and panels should be calm at rest. Do not pair a 1px border with a wide soft shadow as decoration.

## 5. Components

### Buttons

- **Shape:** Theme-controlled control radius (6px by default). Round buttons are acceptable in login flows that already use Naive UI `round`, but product work surfaces should stay compact.
- **Primary:** Use `NButton type="primary"` for the main committed action on a surface.
- **Secondary / Ghost / Quaternary:** Use Naive UI variants, especially `quaternary`, `ghost`, and default buttons, before writing custom button CSS.
- **Hover / Focus:** Inherit Naive UI theme states. Do not replace them with local-only hover colors unless the theme token also changes.
- **Icon buttons:** Use existing `ButtonIcon` plus `SvgIcon` or Iconify conventions with tooltips.

### Cards / Containers

- **Corner Style:** Dashboard and page cards use the `card-wrapper` shortcut with 8px radius. Larger auth or preset panels may use 12px to 16px where the existing project already does.
- **Background:** Use `bg-container` or Naive UI card surfaces over `bg-layout`.
- **Shadow Strategy:** Low lift only. No glass cards, decorative blur, side stripes, or oversized floating panels.
- **Internal Padding:** Default to 16px for dashboard cards and 24px for roomier forms or auth panels.

### Inputs / Fields

- **Style:** Use `NForm`, `NFormItem`, `NInput`, `NInputNumber`, `NSelect`, `NDatePicker`, and other Naive UI fields.
- **Focus:** Inherit Naive UI focus states from the theme. Do not create one-off outlines.
- **Error / Disabled:** Keep validation in `NFormItem` rules and disabled states in component props. Page-level success or failure should use Naive UI message, notification, dialog, or alert patterns.

### Navigation

- **Shell:** `AdminLayout`, `GlobalHeader`, `GlobalSider`, `GlobalTab`, and `GlobalContent` own the app structure.
- **Menu:** Route-driven menus should keep existing active color, collapsed widths, mixed layout behavior, and i18n labels.
- **Tabs:** Use the theme tab mode and tab store. Do not create page-local tab bars that compete with global route tabs unless they are inner workflow tabs built with Naive UI.
- **Mobile:** Sider collapse and mask behavior belong to `AdminLayout`. Page content should adapt through Naive UI grid spans and existing `appStore.isMobile` checks.

### Feedback

- **Messages:** Use `window.$message` for quick success, warning, and error feedback.
- **Dialogs:** Use `window.$dialog` or Naive UI dialog components for destructive confirmations.
- **Notifications:** Use `window.$notification` for longer async or background status.
- **Loading:** Use Naive UI loading states, skeletons, or existing loading bar patterns. Avoid isolated spinners in empty content when a skeleton or table loading state is available.

### Data And Workbench Surfaces

- **Tables:** Use Naive UI table or project table hooks and header operation components. Keep filters, batch actions, refresh, column settings, and pagination consistent.
- **Empty states:** Use project SVG assets and Naive UI empty or card patterns. Empty states should say what the user can do next.
- **Charts:** Keep ECharts inside Naive UI cards with clear card titles and compact legends.

## 6. Do's and Don'ts

### Do:

- **Do** use Naive UI as the default UI component system for product pages.
- **Do** compose business components from Naive UI and existing project wrappers before writing local CSS.
- **Do** keep colors, radius, shadows, dark mode, and layout settings tied to `src/theme/settings.ts` and the theme store.
- **Do** use `NSpace`, `NGrid`, `NGi`, `NCard`, `NForm`, `NButton`, `NDrawer`, `NModal`, `NAlert`, `NTag`, `NTooltip`, and Naive UI feedback providers for standard product UI.
- **Do** keep product pages action-first: filters, records, primary action, secondary actions, and feedback should be obvious.
- **Do** preserve i18n, route meta, tab cache, responsive layout behavior, and existing app shell contracts.

### Don't:

- **Don't** build custom UI controls that duplicate Naive UI components.
- **Don't** use marketing landing-page composition inside authenticated admin screens.
- **Don't** add glassmorphism, gradient text, side-stripe card accents, decorative blur, oversized hero metrics, or hand-drawn SVG scenes.
- **Don't** hard-code a separate palette, radius scale, shadow system, or motion language inside a page.
- **Don't** invent page-local modals, drawers, toasts, tables, selects, tabs, or tooltips when Naive UI already provides the interaction.
- **Don't** use uppercase tracked eyebrows or numbered section markers as default scaffolding in product pages.
