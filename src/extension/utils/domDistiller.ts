import type {
  DistilledField,
  DistillationResult,
  SupportedFieldType,
} from '../types/contracts';

const MAX_LABEL_LENGTH = 300; // Documented Guardrail #5 limit

const INTERACTIVE_SELECTOR = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])',
  'select',
  'textarea',
  '[role="combobox"]',
  '[role="radiogroup"]',
].join(', ');

/**
 * Guardrail #5: DOM Prompt-Injection Sanitizer
 * Strips HTML tags, zero-width/control characters, collapses whitespace, and caps at 300 chars.
 */
export function sanitizeLabel(rawText: string | null | undefined): string {
  if (!rawText) return '';
  return rawText
    .replace(/<[^>]*>/g, ' ') // Strip embedded HTML tags
    .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '') // Strip zero-width & control chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL_LENGTH);
}

/**
 * Checks whether an element is visible to the human user and interactive.
 */
export function isElementVisibleAndEnabled(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
    return false;
  }
  if (el.getAttribute('aria-hidden') === 'true' || el.hidden) {
    return false;
  }

  const style = window.getComputedStyle(el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    parseFloat(style.opacity) === 0
  ) {
    return false;
  }

  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Extracts text only from visible child nodes (ignoring hidden prompt-injection spans).
 */
function getVisibleTextContent(root: Element | null): string {
  if (!root) return '';
  if (root instanceof HTMLElement) {
    const style = window.getComputedStyle(root);
    if (style.display === 'none' || style.visibility === 'hidden') return '';
  }
  return sanitizeLabel(root.textContent);
}

/**
 * Documented 4-Level Label Resolution Waterfall:
 * 1. Explicit <label for="id"> or wrapping <label>
 * 2. Accessibility attributes (aria-label, aria-labelledby, aria-describedby)
 * 3. Closest preceding text label inside the same field container
 * 4. ATS/fallback attributes (data-automation-id, data-qa, placeholder, name)
 */
export function resolveFieldLabel(el: HTMLElement): string {
  // Priority 1: Explicit <label for="..."> or parent <label>
  const id = el.getAttribute('id');
  if (id) {
    const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
    const explicitLabel = document.querySelector(`label[for="${escapedId}"]`);
    const labelText = getVisibleTextContent(explicitLabel);
    if (labelText) return labelText;
  }

  const parentLabel = el.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, select, textarea').forEach((node) => node.remove());
    const text = sanitizeLabel(clone.textContent);
    if (text) return text;
  }

  // Priority 2: ARIA accessibility attributes
  const ariaLabel = sanitizeLabel(el.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const joined = ariaLabelledBy
      .split(/\s+/)
      .map((refId) => getVisibleTextContent(document.getElementById(refId)))
      .filter(Boolean)
      .join(' ');
    if (joined) return sanitizeLabel(joined);
  }

  // Priority 3: Nearby label element inside the closest field container
  const wrapper = el.closest(
    '[data-automation-id], [data-qa], .field, .form-group, .application-question, fieldset, div'
  );
  if (wrapper) {
    const candidateLabel = wrapper.querySelector('label, [class*="label"], legend');
    const text = getVisibleTextContent(candidateLabel);
    if (text) return text;
  }

  // Priority 4: Placeholder or attribute fallback
  const placeholder = sanitizeLabel(el.getAttribute('placeholder'));
  if (placeholder) return placeholder;

  const automationAttr =
    el.getAttribute('data-automation-id') ||
    el.getAttribute('data-qa') ||
    el.getAttribute('name') ||
    id ||
    'unlabeled_field';

  return sanitizeLabel(automationAttr.replace(/[_-]+/g, ' '));
}

/**
 * Finds the nearest preceding section heading (h1-h4, legend) to distinguish sections
 * such as "Work Experience" vs. "Education" vs. "Application Questions".
 */
export function resolveSectionHeader(el: HTMLElement): string {
  const fieldset = el.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    const legendText = getVisibleTextContent(legend);
    if (legendText) return legendText;
  }

  let current: HTMLElement | null = el;
  while (current && current !== document.body) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (/^(H1|H2|H3|H4|LEGEND)$/.test(sibling.tagName)) {
        const headerText = getVisibleTextContent(sibling);
        if (headerText) return headerText;
      }
      const nestedHeading = sibling.querySelector('h1, h2, h3, h4, legend');
      const nestedText = getVisibleTextContent(nestedHeading);
      if (nestedText) return nestedText;
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }

  return 'General Information';
}

/**
 * Determines the normalized SupportedFieldType for a DOM control.
 */
function detectFieldType(el: HTMLElement): SupportedFieldType {
  if (el.getAttribute('role') === 'combobox') return 'combobox';
  if (el instanceof HTMLSelectElement) return 'select';
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  if (el instanceof HTMLInputElement) {
    const rawType = (el.type || 'text').toLowerCase();
    if (
      rawType === 'email' ||
      rawType === 'tel' ||
      rawType === 'url' ||
      rawType === 'number' ||
      rawType === 'date' ||
      rawType === 'radio' ||
      rawType === 'checkbox' ||
      rawType === 'file'
    ) {
      return rawType;
    }
  }
  return 'text';
}

/**
 * Extracts available option strings for <select> or radio groups.
 */
function extractFieldOptions(el: HTMLElement, fieldType: SupportedFieldType): string[] | undefined {
  if (el instanceof HTMLSelectElement) {
    const opts = Array.from(el.options)
      .map((opt) => sanitizeLabel(opt.text))
      .filter((text) => text && !/^(select|choose|--)/i.test(text));
    return opts.length > 0 ? opts : undefined;
  }

  if (fieldType === 'radio' && el instanceof HTMLInputElement && el.name) {
    const escapedName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(el.name) : el.name;
    const radios = document.querySelectorAll<HTMLInputElement>(
      `input[type="radio"][name="${escapedName}"]`
    );
    const opts = Array.from(radios)
      .map((r) => resolveFieldLabel(r) || sanitizeLabel(r.value))
      .filter(Boolean);
    return opts.length > 0 ? Array.from(new Set(opts)) : undefined;
  }

  return undefined;
}

/**
 * Estimates token count (~4 characters per token heuristic) so we can measure
 * payloads against the documented <400 token target.
 */
export function estimateTokenCount(fields: DistilledField[]): number {
  const jsonString = JSON.stringify(fields);
  return Math.ceil(jsonString.length / 4);
}

/**
 * Phase A Client-Side DOM Distillation Engine.
 * Scans document.body, tags interactive elements with data-af-uid, and returns
 * a compact DistilledField array + token telemetry.
 */
export function distillCareerPageDOM(root: ParentNode = document.body): DistillationResult {
  const candidates = Array.from(root.querySelectorAll(INTERACTIVE_SELECTOR));
  const seenRadioGroups = new Set<string>();
  const distilledFields: DistilledField[] = [];
  let uidCounter = 1;

  for (const node of candidates) {
    if (!isElementVisibleAndEnabled(node)) continue;

    const fieldType = detectFieldType(node);

    // Deduplicate radio inputs sharing the same group name
    if (fieldType === 'radio' && node instanceof HTMLInputElement && node.name) {
      if (seenRadioGroups.has(node.name)) continue;
      seenRadioGroups.add(node.name);
    }

    const fieldUid = node.getAttribute('data-af-uid') || `af-field-${uidCounter++}`;
    node.setAttribute('data-af-uid', fieldUid);

    const labelText = resolveFieldLabel(node);
    const sectionHeader = resolveSectionHeader(node);
    const automationId = sanitizeLabel(
      node.getAttribute('data-automation-id') ||
        node.getAttribute('data-qa') ||
        node.getAttribute('name') ||
        node.getAttribute('id') ||
        fieldUid
    );

    const options = extractFieldOptions(node, fieldType);
    const required =
      node.hasAttribute('required') ||
      node.getAttribute('aria-required') === 'true' ||
      /\*\s*$/.test(labelText);

    const descriptor: DistilledField = {
      field_uid: fieldUid,
      label_text: labelText,
      section_header: sectionHeader,
      field_type: fieldType,
      automation_id: automationId,
      ...(options ? { options } : {}),
      required,
    };

    distilledFields.push(descriptor);
  }

  return {
    portal_domain: window.location.hostname || 'local_test_portal',
    fields: distilledFields,
    estimated_tokens: estimateTokenCount(distilledFields),
    scanned_at: new Date().toISOString(),
  };
}