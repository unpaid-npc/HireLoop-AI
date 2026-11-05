import { distillCareerPageDOM } from '../utils/domDistiller';

export default defineContentScript({
  matches: [
    '*://*.myworkdayjobs.com/*',
    '*://*.greenhouse.io/*',
    '*://*.lever.co/*',
    '*://*.ashbyhq.com/*',
    'http://localhost/*',
  ],
  main() {
    console.log('[HireLoop AI] Content script loaded on:', window.location.hostname);
    // Expose manual trigger in DevTools console for testing Phase A distillation
    (window as unknown as Record<string, unknown>).__runHireLoopDistill = () => {
      const result = distillCareerPageDOM();
      console.log('[HireLoop AI] Distilled DOM Payload:', result);
      return result;
    };
  },
});