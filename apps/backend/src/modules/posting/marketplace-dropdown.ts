import type { Locator, Page } from 'playwright';
import { logger } from '../../config/logger';
import { randomBetween, randomDelay } from '../../utils/human-behavior';
import { SELECTORS } from './marketplace.selectors';
import {
  MARKETPLACE_CATEGORY_OPTIONS,
  MARKETPLACE_CONDITION_OPTIONS,
} from './marketplace.constants';

export type MarketplaceFieldName = 'Category' | 'Condition';

interface FieldDefinition {
  fieldName: MarketplaceFieldName;
  placeholder: string;
  defaultOptions: readonly string[];
  aliases: Record<string, string[]>;
  dropdownSelector: string;
}

const CATEGORY_FIELD: FieldDefinition = {
  fieldName: 'Category',
  placeholder: 'Category',
  defaultOptions: MARKETPLACE_CATEGORY_OPTIONS,
  dropdownSelector: SELECTORS.marketplace.categoryDropdown,
  aliases: {
    'Home & Garden': ['Home and Garden', 'Home & Garden', 'Garden', 'Home Goods'],
    'Tools & Home Improvement': ['Home Improvement', 'Tools', 'Home & Garden', 'Tools & Home Improvement'],
    Household: ['Home & Garden', 'Household', 'Miscellaneous', 'Home Goods'],
    Other: ['Miscellaneous', 'Other'],
    Services: ['Services', 'Miscellaneous'],
  },
};

const CONDITION_FIELD: FieldDefinition = {
  fieldName: 'Condition',
  placeholder: 'Condition',
  defaultOptions: MARKETPLACE_CONDITION_OPTIONS,
  dropdownSelector: SELECTORS.marketplace.conditionDropdown,
  aliases: {
    New: ['New'],
    'Used - Like New': ['Used – Like New', 'Used - like new', 'Like New'],
    'Used - Good': ['Used – Good', 'Used - good'],
    'Used - Fair': ['Used – Fair', 'Used - fair'],
  },
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expandFieldOptions(field: FieldDefinition, preferred?: string): string[] {
  const trimmed = preferred?.trim();
  if (!trimmed) return [...field.defaultOptions];

  const aliases = field.aliases[trimmed] ?? [];
  return [...new Set([trimmed, ...aliases, ...field.defaultOptions])];
}

async function firstVisibleLocator(page: Page, locators: Locator[]): Promise<Locator | null> {
  for (const locator of locators) {
    const candidate = locator.first();
    if (await candidate.isVisible({ timeout: 600 }).catch(() => false)) {
      return candidate;
    }
  }
  return null;
}

function buildControlLocators(page: Page, field: FieldDefinition): Locator[] {
  const label = field.fieldName;
  return [
    page.getByRole('combobox', { name: new RegExp(`^${label}$`, 'i') }),
    page.getByRole('combobox', { name: new RegExp(label, 'i') }),
    page.locator(`input[placeholder="${field.placeholder}"]`),
    page.locator(`input[aria-label="${label}"]`),
    page.locator(`input[aria-label*="${label}" i]`),
    page.locator(field.dropdownSelector),
    page.locator(`[role="combobox"][aria-label*="${label}" i]`),
    page.locator(`div[aria-label="${label}"][role="button"]`),
    page.getByLabel(new RegExp(`^${label}$`, 'i')),
    page
      .locator('div')
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator('input, [role="combobox"], [role="button"]'),
    page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }),
  ];
}

async function findFieldControl(page: Page, field: FieldDefinition): Promise<Locator | null> {
  return firstVisibleLocator(page, buildControlLocators(page, field));
}

async function waitForFieldControl(page: Page, field: FieldDefinition): Promise<Locator | null> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const control = await findFieldControl(page, field);
    if (control) return control;
    await randomDelay(400, 700);
  }
  return null;
}

async function isFieldSelected(
  page: Page,
  field: FieldDefinition,
  expected?: string,
): Promise<boolean> {
  const placeholderVisible = await page
    .locator(`input[placeholder="${field.placeholder}"]`)
    .first()
    .isVisible({ timeout: 800 })
    .catch(() => false);

  const control = await findFieldControl(page, field);

  if (!control) {
    return !placeholderVisible;
  }

  const inputValue = (await control.inputValue().catch(() => '')).trim();
  if (inputValue.length >= 2) {
    if (!expected) return true;
    return valuesMatch(expected, inputValue);
  }

  const text = ((await control.textContent().catch(() => '')) ?? '').trim();
  if (text.length >= 2 && !new RegExp(`^${field.fieldName}$`, 'i').test(text)) {
    if (!expected) return true;
    return valuesMatch(expected, text);
  }

  const labelledValue = await page
    .locator('div')
    .filter({ has: page.getByText(field.fieldName, { exact: true }) })
    .first()
    .textContent()
    .catch(() => '');
  const cleanedLabel = (labelledValue ?? '').replace(new RegExp(field.fieldName, 'i'), '').trim();
  if (cleanedLabel.length >= 2) {
    if (!expected) return true;
    return valuesMatch(expected, cleanedLabel);
  }

  return !placeholderVisible && !expected;
}

function valuesMatch(expected: string, actual: string): boolean {
  const norm = expected.toLowerCase().replace(/–/g, '-').trim();
  const actualNorm = actual.toLowerCase().replace(/–/g, '-').trim();
  return actualNorm.includes(norm) || norm.includes(actualNorm);
}

async function waitForFieldOverlay(page: Page): Promise<void> {
  await page
    .locator('[role="dialog"], [role="listbox"], [role="menu"]')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => undefined);
  await randomDelay(250, 500);
}

async function clickVisibleOption(page: Page, locator: Locator): Promise<boolean> {
  if (!(await locator.isVisible({ timeout: 1000 }).catch(() => false))) {
    return false;
  }

  const box = await locator.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
      delay: randomBetween(40, 120),
    });
    return true;
  }

  await locator.click({ timeout: 5000, force: true });
  return true;
}

async function clickOptionInOverlay(page: Page, label: string): Promise<boolean> {
  const escaped = escapeRegex(label);
  const exact = new RegExp(`^${escaped.replace(/\\–/g, '[\\-–]')}$`, 'i');
  const scopes = [
    page.locator('[role="dialog"]:visible'),
    page.locator('[role="listbox"]:visible'),
    page.locator('[role="menu"]:visible'),
  ];

  for (const scope of scopes) {
    if (!(await scope.count())) continue;

    const candidates = [
      scope.getByRole('option', { name: exact }),
      scope.getByRole('menuitem', { name: exact }),
      scope.getByRole('button', { name: exact }),
      scope.getByRole('radio', { name: exact }),
      scope.locator('[role="option"], [role="menuitem"], [role="gridcell"], [role="row"]').filter({
        hasText: exact,
      }),
      scope.getByText(label, { exact: true }),
    ];

    for (const candidate of candidates) {
      if (await clickVisibleOption(page, candidate.first())) {
        return true;
      }
    }
  }

  const domClicked = await page.evaluate(
    `(function(target) {
      var norm = target.toLowerCase().replace(/\\u2013/g, '-');
      var roots = document.querySelectorAll('[role="dialog"], [role="listbox"], [role="menu"]');
      if (!roots.length) roots = [document.body];

      function isVisible(el) {
        var rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return false;
        var style = window.getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
      }

      function normalize(text) {
        return (text || '').trim().toLowerCase().replace(/\\u2013/g, '-');
      }

      function tryClick(root) {
        var selectors = '[role="option"], [role="menuitem"], [role="button"], [role="gridcell"], [role="row"], li, span';
        var nodes = root.querySelectorAll(selectors);
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if (!isVisible(node)) continue;
          if (normalize(node.textContent) === norm) {
            node.click();
            return true;
          }
        }
        for (var j = 0; j < nodes.length; j++) {
          var partial = nodes[j];
          if (!isVisible(partial)) continue;
          var partialText = normalize(partial.textContent);
          if (partialText && partialText.length < 80 && partialText.indexOf(norm) >= 0) {
            partial.click();
            return true;
          }
        }
        return false;
      }

      for (var r = 0; r < roots.length; r++) {
        if (tryClick(roots[r])) return true;
      }
      return false;
    })(${JSON.stringify(label)})`,
  );

  return Boolean(domClicked);
}

async function confirmNestedSelectionIfNeeded(
  page: Page,
  field: FieldDefinition,
  label: string,
): Promise<boolean> {
  if (await isFieldSelected(page, field, label)) {
    return true;
  }

  await waitForFieldOverlay(page);

  if (await clickOptionInOverlay(page, label)) {
    await randomDelay(400, 800);
    if (await isFieldSelected(page, field, label)) {
      return true;
    }
  }

  const subOptions = page.locator(
    '[role="dialog"]:visible [role="option"], [role="listbox"]:visible [role="option"], [role="dialog"]:visible [role="button"]',
  );
  const count = await subOptions.count();
  for (let index = 0; index < Math.min(count, 8); index++) {
    const option = subOptions.nth(index);
    const text = ((await option.textContent().catch(() => '')) ?? '').trim();
    if (!text || /^back$/i.test(text) || /^cancel$/i.test(text)) continue;

    if (await clickVisibleOption(page, option)) {
      await randomDelay(400, 800);
      if (await isFieldSelected(page, field, label)) {
        return true;
      }
    }
  }

  return isFieldSelected(page, field, label);
}

async function typeIntoOverlaySearch(page: Page, label: string): Promise<boolean> {
  const searchFields = [
    page.locator('[role="dialog"]:visible input[type="search"]'),
    page.locator('[role="dialog"]:visible input[type="text"]'),
    page.locator('[role="listbox"]:visible ~ input'),
    page.locator('[role="dialog"]:visible [role="combobox"] input'),
  ];

  for (const search of searchFields) {
    const field = search.first();
    if (!(await field.isVisible({ timeout: 800 }).catch(() => false))) continue;
    await field.click({ timeout: 3000 }).catch(() => undefined);
    await field.fill('');
    await field.fill(label);
    await randomDelay(400, 800);
    return true;
  }

  return false;
}

async function selectViaKeyboard(
  page: Page,
  fieldDef: FieldDefinition,
  control: Locator,
  label: string,
): Promise<boolean> {
  await control.click({ timeout: 8000, delay: randomBetween(40, 120) });
  await randomDelay(200, 400);
  await page.keyboard.press('Control+A').catch(() => undefined);
  await page.keyboard.press('Backspace').catch(() => undefined);
  await page.keyboard.type(label, { delay: randomBetween(20, 45) });
  await randomDelay(500, 900);
  await waitForFieldOverlay(page);

  const firstOption = page.locator('[role="listbox"]:visible [role="option"]').first();
  if (await firstOption.isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.keyboard.press('ArrowDown');
    await randomDelay(120, 250);
    await page.keyboard.press('Enter');
    await randomDelay(400, 800);
    if (await isFieldSelected(page, fieldDef, label)) return true;
    await clickVisibleOption(page, firstOption);
    await randomDelay(400, 800);
    if (await isFieldSelected(page, fieldDef, label)) return true;
  }

  return false;
}

async function selectMarketplaceField(
  page: Page,
  fieldDef: FieldDefinition,
  preferred: string,
): Promise<boolean> {
  if (await isFieldSelected(page, fieldDef, preferred)) {
    return true;
  }

  const options = expandFieldOptions(fieldDef, preferred);
  logger.info(
    { field: fieldDef.fieldName, preferred, options: options.slice(0, 6) },
    'Selecting Marketplace dropdown',
  );

  const control = await waitForFieldControl(page, fieldDef);
  if (!control) {
    logger.warn({ field: fieldDef.fieldName, preferred }, 'Dropdown control not found');
    return false;
  }

  for (const label of options) {
    await page.keyboard.press('Escape').catch(() => undefined);
    await randomDelay(150, 300);

    await control.click({ timeout: 8000, delay: randomBetween(40, 120) });
    await waitForFieldOverlay(page);

    if (await clickOptionInOverlay(page, label)) {
      await randomDelay(500, 900);
      if (await confirmNestedSelectionIfNeeded(page, fieldDef, label)) {
        logger.info({ field: fieldDef.fieldName, selected: label, method: 'overlay-click' }, 'Dropdown selected');
        return true;
      }
    }

    await page.keyboard.press('Escape').catch(() => undefined);
    await randomDelay(150, 300);

    await control.click({ timeout: 8000, delay: randomBetween(40, 120) }).catch(() => undefined);
    await waitForFieldOverlay(page);

    if (await typeIntoOverlaySearch(page, label) && (await clickOptionInOverlay(page, label))) {
      await randomDelay(500, 900);
      if (await confirmNestedSelectionIfNeeded(page, fieldDef, label)) {
        logger.info({ field: fieldDef.fieldName, selected: label, method: 'overlay-search' }, 'Dropdown selected');
        return true;
      }
    }

    if (
      (await selectViaKeyboard(page, fieldDef, control, label)) &&
      (await confirmNestedSelectionIfNeeded(page, fieldDef, label))
    ) {
      logger.info({ field: fieldDef.fieldName, selected: label, method: 'keyboard' }, 'Dropdown selected');
      return true;
    }

    await page.keyboard.press('Escape').catch(() => undefined);
  }

  logger.warn({ field: fieldDef.fieldName, preferred }, 'Could not select dropdown value');
  return false;
}

export const findCategoryControl = (page: Page) => findFieldControl(page, CATEGORY_FIELD);
export const waitForCategoryControl = (page: Page) => waitForFieldControl(page, CATEGORY_FIELD);
export const isCategorySelected = (page: Page, expected?: string) =>
  isFieldSelected(page, CATEGORY_FIELD, expected);
export const selectMarketplaceCategory = (page: Page, category: string) =>
  selectMarketplaceField(page, CATEGORY_FIELD, category);

export const findConditionControl = (page: Page) => findFieldControl(page, CONDITION_FIELD);
export const waitForConditionControl = (page: Page) => waitForFieldControl(page, CONDITION_FIELD);
export const isConditionSelected = (page: Page, expected?: string) =>
  isFieldSelected(page, CONDITION_FIELD, expected);
export const selectMarketplaceCondition = (page: Page, condition: string) =>
  selectMarketplaceField(page, CONDITION_FIELD, condition);

export async function waitForListingForm(page: Page): Promise<void> {
  await waitForFieldControl(page, CATEGORY_FIELD);
  await waitForFieldControl(page, CONDITION_FIELD);
}
