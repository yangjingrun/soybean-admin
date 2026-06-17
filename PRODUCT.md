# Product

## Register

product

## Users

SoybeanAdmin serves developers and product teams who need to build authenticated admin systems, dashboards, settings panels, and operational tools on Vue 3. The day-to-day user of a built screen is usually an operator, admin, or business teammate trying to read data, filter records, complete forms, and move work forward without visual noise.

## Product Purpose

This project is a Naive UI based Vue admin template. It exists to provide a stable, themeable, and extensible middle-office foundation with routing, permissions, i18n, layout modes, tabs, theme settings, and reusable UI conventions already in place.

Success means new screens feel native to the existing shell: clear hierarchy, predictable controls, fast scanning, reliable feedback, and no separate custom UI language competing with the project design system.

## Brand Personality

Clear, professional, restrained.

The interface should feel fresh and orderly, but still practical. It should make complex admin tasks feel manageable through consistent structure, not through decoration.

## Anti-references

- Custom UI controls that duplicate Naive UI components.
- Marketing landing-page composition inside authenticated product screens.
- Decorative motion, glass effects, gradient text, side-stripe card accents, and oversized hero-metric layouts.
- Inconsistent button, form, card, table, drawer, modal, or notification patterns across pages.
- Dense dashboards that only show metrics but do not make the user's next action obvious.

## Design Principles

1. Naive UI first. Use Naive UI and existing project components as the default surface for buttons, forms, tables, cards, grids, drawers, modals, notifications, tooltips, tabs, menus, and feedback.
2. Theme tokens own the look. Colors, radius, shadows, layout heights, dark mode, grayscale mode, and color-weakness mode come from the theme store and `src/theme/settings.ts`.
3. Product work beats page decoration. Each screen should make the primary task, filters, records, actions, and feedback easy to find.
4. Keep patterns shared. Extract reusable methods, composables, and business components when a pattern appears in more than one place, but do not abstract before there is real duplication.
5. Preserve the shell contract. Header, sider, tab, content padding, route cache, i18n, loading, and feedback should follow the existing app shell instead of local one-off implementations.

## Accessibility & Inclusion

Target WCAG AA for product UI. Body text must meet 4.5:1 contrast, interactive controls need keyboard focus states, destructive actions need clear confirmation, and status changes should be visible through Naive UI messages, notifications, dialogs, tags, or alerts.

Respect the project's built-in dark mode, grayscale mode, and color-weakness mode. Page motion should remain short and state-driven, with reduced-motion alternatives when new animation is introduced.
