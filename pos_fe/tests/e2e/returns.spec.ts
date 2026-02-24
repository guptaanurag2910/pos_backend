import { expect, test } from '@playwright/test';
import { gotoReturns, login } from './helpers';

test.describe('Returns flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await gotoReturns(page);
  });

  test('create return from completed bill', async ({ page }) => {
    await page.getByTestId('returns-process-button').click();
    await expect(page.getByRole('heading', { name: /select bill for return/i })).toBeVisible();

    const noBills = page.getByText('No bills found');
    if (await noBills.isVisible()) {
      test.skip(true, 'No completed bills available for return test.');
    }

    const billCards = page.getByTestId('returns-bill-card');
    const billCount = await billCards.count();
    test.skip(billCount === 0, 'No bill cards rendered for return flow.');

    await billCards.first().click();
    await expect(page.getByRole('heading', { name: /^process return$/i })).toBeVisible();

    await page.locator('label:has-text("Return Reason") + select').selectOption({ label: 'Product defective' });

    const qtyInputs = page.getByTestId('returns-item-qty');
    const reasonInputs = page.getByTestId('returns-item-reason');

    const qtyCount = await qtyInputs.count();
    test.skip(qtyCount === 0, 'No returnable bill items found.');

    await qtyInputs.first().fill('1');
    await reasonInputs.first().fill('Damaged pack');

    await page.getByTestId('returns-process-submit').click();

    await expect(page.getByRole('heading', { name: /returns & refunds/i })).toBeVisible();
    await expect(page.getByText(/return/i).first()).toBeVisible();
  });

  test('open return details from list', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    test.skip(count === 0, 'No returns available to view details.');

    await rows.first().locator('button').first().click();
    await expect(page.getByText(/return details/i)).toBeVisible({ timeout: 10_000 });

    await page.keyboard.press('Escape');
  });
});
