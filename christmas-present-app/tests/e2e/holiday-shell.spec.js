const { test, expect } = require('@playwright/test');

test('sign-in page presents both account paths and works by keyboard', async ({ page }) => {
  await page.goto('/login.html');
  await expect(page.getByRole('heading', { name: 'Santa Pack' })).toBeVisible();
  await expect(page.getByText('Welcome to Santa Pack')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unwrap my exchange' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join the nice list' })).toBeVisible();

  await page.locator('#email').focus();
  await page.keyboard.type('kate@example.com');
  await page.keyboard.press('Tab');
  await page.keyboard.type('very-merry-password');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Unwrap my exchange' })).toBeFocused();
});

test('holiday shell stays usable at each configured viewport', async ({ page }) => {
  await page.goto('/login.html');
  const card = page.locator('.page-card__container');
  await expect(card).toBeVisible();
  const viewport = page.viewportSize();
  const box = await card.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  await expect(page.locator('body')).toHaveCSS('font-family', /DM Sans/);
});

test('signed-in family journey surfaces useful example data', async ({ page }) => {
  await page.addInitScript(() => {
    window.supabase = {
      createClient() {
        return {
          auth: {
            getSession: async () => ({ data: { session: { access_token: 'test-token', user: { id: 'user-1' } } } }),
            signOut: async () => ({ error: null })
          },
          from(table) {
            const query = {
              select() { return query; },
              eq() { return query; },
              is() { return query; },
              in() { return query; },
              maybeSingle: async () => table === 'profiles'
                ? { data: { role: 'user' }, error: null }
                : { data: { id: 1001 }, error: null },
              then(resolve) {
                const data = table === 'person'
                  ? [{ id: 1001, family: { id: 101, name: 'The McCallisters' }, family_pending: null }]
                  : [];
                resolve({ data, error: null });
              }
            };
            return query;
          }
        };
      }
    };
  });
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/api/families/101/gift-rounds', (route) => route.fulfill({ json: [
    { id: 5001, name: 'Christmas Eve 2026', stage: 'giving' },
    { id: 5002, name: 'Last Year’s Legendary Exchange', stage: 'complete' }
  ] }));
  await page.route('**/api/families/101/people', (route) => route.fulfill({ json: [
    { id: 1001, name: 'Kate' }, { id: 1002, name: 'Peter' }, { id: 1003, name: 'Kevin' }, { id: 1004, name: 'Buzz' }
  ] }));

  await page.goto('/index.html');
  await expect(page.getByRole('heading', { name: 'Your holiday households' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The McCallisters' })).toBeVisible();
  await expect(page.getByText('4 merry makers')).toBeVisible();
  await expect(page.getByText('2 gift rounds')).toBeVisible();
  await page.getByRole('button', { name: 'Open family →' }).click();
  await expect(page).toHaveURL(/giftRounds\.html\?familyId=101/);
});

test('forgot-password request uses the deployed reset page without revealing account existence', async ({ page }) => {
  await page.addInitScript(() => {
    window.supabase = {
      createClient() {
        return {
          auth: {
            resetPasswordForEmail: async (email, options) => {
              window.__resetRequest = { email, redirectTo: options.redirectTo };
              return { data: {}, error: null };
            },
            getSession: async () => ({ data: { session: null } })
          }
        };
      }
    };
  });
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.goto('/login.html');
  await page.getByText('Forgot your password?').click();
  await page.getByLabel('Account email').fill('kevin@example.com');
  await page.getByRole('button', { name: 'Email me a reset link' }).click();
  await expect(page.getByRole('status')).toContainText('If that address belongs to an account');
  const request = await page.evaluate(() => window.__resetRequest);
  expect(request).toEqual({
    email: 'kevin@example.com',
    redirectTo: 'http://127.0.0.1:4273/reset-password.html'
  });
});

test('reset page validates matching passwords before updating the account', async ({ page }) => {
  await page.addInitScript(() => {
    window.supabase = {
      createClient() {
        return {
          auth: {
            getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
            updateUser: async () => ({ data: {}, error: null }),
            signOut: async () => ({ error: null })
          }
        };
      }
    };
  });
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.goto('/reset-password.html');
  await page.getByLabel('New password', { exact: true }).fill('merry-password');
  await page.getByLabel('Confirm new password').fill('different-password');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('status')).toHaveText('Those passwords do not match.');
});
