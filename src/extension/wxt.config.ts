import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'HireLoop AI — Career Page Auto-Fill Assistant',
    version: '0.1.0',
    description:
      'Human-in-the-Loop AI Career Page Auto-Fill Assistant & Self-Learning Agent Architecture',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: [
      '*://*.myworkdayjobs.com/*',
      '*://*.greenhouse.io/*',
      '*://*.lever.co/*',
      '*://*.ashbyhq.com/*',
      'http://localhost:8000/*', // Shubh's FastAPI backend (local dev)
    ],
  },
});