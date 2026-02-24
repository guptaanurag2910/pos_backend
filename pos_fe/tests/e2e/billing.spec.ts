import { expect, test } from '@playwright/test';
import { addFirstInStockProduct, gotoBilling, login } from './helpers';

test.describe('Billing flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await gotoBilling(page);
  });

  test('add product by search, apply/remove discount, complete cash payment', async ({ page }) => {
    const product = await addFirstInStockProduct(page);
    test.skip(!product, 'No in-stock products available for billing test.');

    await page.getByTestId('billing-apply-discount').click();
    await page.getByRole('button', { name: /percentage/i }).click();
    await page.locator('input[placeholder="Enter percentage"]').fill('5');
    await page.getByRole('button', { name: /^apply discount$/i }).click();

    await expect(page.getByRole('button', { name: /remove discount/i })).toBeVisible();
    await page.getByRole('button', { name: /remove discount/i }).click();

    await expect(page.getByRole('button', { name: /remove discount/i })).not.toBeVisible();

    const payButtonText = await page.getByTestId('billing-pay-button').innerText();
    const amountMatch = payButtonText.match(/₹\s*([0-9,.]+)/);
    const total = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : 0;

    await page.getByTestId('billing-proceed-payment').click();
    await expect(page.getByRole('heading', { name: /complete payment/i })).toBeVisible();

    await page.getByTestId('payment-method-cash').click();
    await page.getByTestId('payment-cash-received').fill(String(Math.ceil(total + 10)));
    await page.getByTestId('payment-complete').click();

    await expect(page.getByRole('heading', { name: /bill completed/i })).toBeVisible();
    await page.getByRole('button', { name: /start new bill/i }).click();
    await expect(page.getByText('No items in the bill yet')).toBeVisible();
  });

  test('hold and resume bill', async ({ page }) => {
    const product = await addFirstInStockProduct(page);
    test.skip(!product, 'No in-stock products available for hold/resume test.');

    await page.getByTestId('billing-hold-bill').click();
    await expect(page.getByText('No items in the bill yet')).toBeVisible();

    await page.getByTestId('billing-held-bills').click();
    await page.getByTestId('held-bill-resume').first().click();

    await expect(page.getByRole('heading', { name: /complete payment/i })).toBeVisible();
    await page.getByRole('button', { name: /^cancel$/i }).click();
  });

  test('out-of-stock product is not added to cart', async ({ page }) => {
    const input = page.getByTestId('billing-product-search');
    await input.fill('a');

    const rows = page.getByTestId('billing-product-result');
    await rows.first().waitFor({ timeout: 10_000 });

    const count = await rows.count();
    let outOfStockRowIndex = -1;
    for (let i = 0; i < count; i += 1) {
      const rowText = (await rows.nth(i).textContent()) || '';
      const stockMatch = rowText.match(/Stock:\s*([0-9.]+)/i);
      const stock = stockMatch ? Number(stockMatch[1]) : 0;
      if (stock <= 0) {
        outOfStockRowIndex = i;
        break;
      }
    }

    test.skip(outOfStockRowIndex < 0, 'No out-of-stock product present for this dataset.');

    await rows.nth(outOfStockRowIndex).getByTestId('billing-add-product').click({ force: true });
    await expect(page.getByText('No items in the bill yet')).toBeVisible();
  });

  test('barcode style input works (scanner simulation)', async ({ page }) => {
    const product = await addFirstInStockProduct(page);
    test.skip(!product || !product.barcode, 'No scannable product barcode available for scanner simulation.');

    const qtyInput = page.locator('tbody tr').first().locator('input[type=\"number\"]').first();
    const before = Number(await qtyInput.inputValue());

    await page.keyboard.type(product!.barcode, { delay: 15 });
    await page.keyboard.press('Enter');

    await expect
      .poll(async () => Number(await qtyInput.inputValue()), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(before);
  });
});
