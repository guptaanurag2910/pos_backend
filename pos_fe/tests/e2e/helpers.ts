import { expect, Page } from '@playwright/test';

const EMAIL = process.env.POS_E2E_EMAIL || 'admin@gmail.com';
const PASSWORD = process.env.POS_E2E_PASSWORD || 'Admin@123';

export async function login(page: Page): Promise<void> {
  await page.goto('/login');

  if (page.url().includes('/dashboard')) {
    return;
  }

  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
}

export async function gotoBilling(page: Page): Promise<void> {
  await page.goto('/billing');
  await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
}

export async function gotoReturns(page: Page): Promise<void> {
  await page.goto('/returns');
  await expect(page.getByRole('heading', { name: /returns & refunds/i })).toBeVisible();
}

export async function addFirstInStockProduct(page: Page): Promise<{ name: string; barcode: string } | null> {
  const input = page.getByTestId('billing-product-search');
  await input.click();
  await input.fill('a');

  const rows = page.getByTestId('billing-product-result');
  await rows.first().waitFor({ timeout: 10_000 });

  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const text = (await row.textContent()) || '';
    const stockMatch = text.match(/Stock:\s*([0-9.]+)/i);
    const stock = stockMatch ? Number(stockMatch[1]) : 0;
    if (stock > 0) {
      const barcodeMatch = text.match(/Code:\s*([^•\s]+)/i);
      const name = text.split('Code:')[0].trim();
      const barcode = barcodeMatch?.[1]?.trim() || '';

      await row.getByTestId('billing-add-product').click();
      await expect(page.getByText('No items in the bill yet')).not.toBeVisible();
      return { name, barcode };
    }
  }

  return null;
}
