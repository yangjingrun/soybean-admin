import { defineConfig } from '@soybeanjs/eslint-config-vue';

const ruleOverrides = {
  'vue/component-name-in-template-casing': [
    'warn',
    'PascalCase',
    {
      registeredComponentsOnly: false,
      ignores: ['/^icon-/']
    }
  ]
};

export default defineConfig(ruleOverrides as unknown as Record<string, string>);
