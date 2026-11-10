import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { TENANT_ID } from '../../playwright.firebase.config.js';

// The Node side talks to the same emulators as the server, to do what a
// person would do outside the app (click the email link) or what an operator
// does (run scripts/seed-admin.mjs).
const admin = initializeApp({ projectId: 'demo-santa-pack' }, `e2e-${randomUUID()}`);
const tenantAuth = getAuth(admin).tenantManager().authForTenant(TENANT_ID);
const db = getFirestore(admin, 'santa-pack');

const PASSWORD = 'very-merry-password';
const RUN = randomUUID().slice(0, 6);
const SECRET = `Talkboy recorder ${RUN}`;
// Unique per run: the emulators keep data between repeated runs.
const FAMILY = `The McCallisters ${RUN}`;
const CLOAK = 'Operation Mistletoe';

/** @param {string} name */
async function createPerson(name) {
  const email = `${name.toLowerCase()}-${randomUUID().slice(0, 8)}@example.test`;
  await tenantAuth.createUser({ email, password: PASSWORD, emailVerified: true, displayName: name });
  return { name, email };
}

/** @param {import('@playwright/test').Page} page @param {{ email: string }} person */
async function signIn(page, person) {
  await page.goto('/login.html');
  await page.locator('#email').fill(person.email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Unwrap my exchange' }).click();
  await expect(page.getByRole('heading', { name: 'Your families' })).toBeVisible();
}

/** Accept the confirmation dialog the app shows. @param {import('@playwright/test').Page} page @param {string} label */
async function confirm(page, label) {
  await page.getByRole('dialog').getByRole('button', { name: label }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('@mobile sign up, confirm email, and land on an empty family list', async ({ page }) => {
  // Any script error or CSP violation (they log as console errors) fails the test.
  /** @type {string[]} */
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  const email = `newcomer-${randomUUID().slice(0, 8)}@example.test`;
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\.html\?next=/);

  await page.locator('#signupName').fill('Newcomer');
  await page.locator('#signupEmail').fill(email);
  await page.locator('#signupPassword').fill(PASSWORD);
  await page.getByRole('button', { name: 'Join the nice list' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

  // Not confirmed yet: the app says so and stays put.
  await page.getByRole('button', { name: 'I’ve confirmed my email' }).click();
  await expect(page.getByRole('status')).toContainText('Not confirmed yet');

  // "Click the link in the email".
  const account = await tenantAuth.getUserByEmail(email);
  await tenantAuth.updateUser(account.uid, { emailVerified: true });
  await page.getByRole('button', { name: 'I’ve confirmed my email' }).click();

  await expect(page.getByRole('heading', { name: 'Your families' })).toBeVisible();
  await expect(page.getByText('Your list is still blank')).toBeVisible();
  await expect(page.getByText('Welcome back, Newcomer!')).toBeVisible();
  expect(problems).toEqual([]);
});

test('wrong password gets a message that does not reveal whether the account exists', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#email').fill('nobody@example.test');
  await page.locator('#password').fill('not-the-password');
  await page.getByRole('button', { name: 'Unwrap my exchange' }).click();
  await expect(page.getByText('That email and password don’t match.')).toBeVisible();
});

test('a whole gift round, with the gift kept secret until the reveal', async ({ browser }) => {
  test.setTimeout(120_000);
  const people = {
    elf: await createPerson('Elf'),
    kate: await createPerson('Kate'),
    peter: await createPerson('Peter'),
    kevin: await createPerson('Kevin'),
  };
  /** @type {Record<keyof typeof people, import('@playwright/test').Page>} */
  const pages = /** @type {any} */ ({});
  for (const key of /** @type {(keyof typeof people)[]} */ (Object.keys(people))) {
    const page = await (await browser.newContext()).newPage();
    await signIn(page, people[key]);
    pages[key] = page;
  }

  // The operator makes Elf a site admin (what scripts/seed-admin.mjs does).
  const elf = await tenantAuth.getUserByEmail(people.elf.email);
  await db.collection('users').doc(elf.uid).update({ role: 'admin' });

  // Elf creates the family.
  await pages.elf.goto('/admin.html');
  await pages.elf.locator('#familyName').fill(FAMILY);
  await pages.elf.getByRole('button', { name: 'Create family' }).click();
  const familyRow = pages.elf.getByRole('row', { name: new RegExp(FAMILY) });
  await expect(familyRow).toBeVisible();
  const joinCode = (await familyRow.locator('.join-code').textContent())?.trim() ?? '';
  expect(joinCode).toMatch(/^[A-Z2-9]{8}$/);

  // Kate, Peter and Kevin ask to join.
  for (const key of /** @type {const} */ (['kate', 'peter', 'kevin'])) {
    await pages[key].locator('#joinCode').fill(joinCode);
    await pages[key].getByRole('button', { name: 'Ask to join' }).click();
    await expect(pages[key].getByText(`Waiting for approval: ${FAMILY}`)).toBeVisible();
  }

  // Elf lets them in and makes Kate a manager.
  await familyRow.getByRole('link', { name: FAMILY }).click();
  await expect(pages.elf.getByRole('heading', { name: FAMILY, level: 1 })).toBeVisible();
  for (const name of ['Kate', 'Peter', 'Kevin']) {
    await pages.elf
      .getByRole('row', { name: new RegExp(name) })
      .getByRole('button', { name: 'Let them in' })
      .click();
    await expect(pages.elf.getByRole('table', { name: 'Family members' }).getByRole('row', { name })).toBeVisible();
  }
  await pages.elf
    .getByRole('table', { name: 'Family members' })
    .getByRole('row', { name: /Kate/ })
    .getByRole('button', { name: 'Make manager' })
    .click();
  await expect(pages.elf.getByRole('row', { name: /Kate\s+Manager/ })).toBeVisible();

  // Kate starts a round.
  await pages.kate.reload();
  await pages.kate.getByRole('link', { name: 'Open family' }).click();
  await pages.kate.locator('#roundName').fill('Christmas Eve');
  await pages.kate.getByRole('button', { name: 'Start round' }).click();
  await expect(pages.kate.getByRole('heading', { name: 'Christmas Eve', level: 1 })).toBeVisible();
  const roundUrl = pages.kate.url();

  // Peter wraps a gift for Kevin.
  await pages.peter.goto(roundUrl);
  await pages.peter.locator('#receiverUid').selectOption({ label: 'Kevin' });
  await pages.peter.locator('#presentName').fill(SECRET);
  await pages.peter.locator('#cloakedName').fill(CLOAK);
  await pages.peter.getByRole('button', { name: 'Wrap it up' }).click();
  await expect(pages.peter.getByRole('cell', { name: SECRET })).toBeVisible();

  // Kevin watches every API response from here until he unwraps the gift.
  /** @type {string[]} */
  const leaks = [];
  let revealed = false;
  let seenAfterReveal = 0;
  pages.kevin.on('response', async (response) => {
    if (!response.url().includes('/api/')) return;
    const wasRevealed = revealed;
    const text = await response.text().catch(() => '');
    if (!text.includes(SECRET)) return;
    if (wasRevealed) seenAfterReveal += 1;
    else leaks.push(response.url());
  });

  // While giving, Kevin and Kate (a manager, but also a player) see nothing.
  await pages.kevin.goto(roundUrl);
  await expect(pages.kevin.getByText('You haven’t added any gifts yet.')).toBeVisible();
  await pages.kate.reload();
  await expect(pages.kate.getByText(SECRET)).toHaveCount(0);

  // Kate starts guessing.
  await pages.kate.getByRole('button', { name: 'Start guessing' }).click();
  await confirm(pages.kate, 'Start guessing');
  await expect(pages.kate.locator('.stage-badge')).toHaveText('guessing');

  // Kevin sees only the cloaked name, guesses Kate (wrong), then unwraps.
  await pages.kevin.reload();
  const card = pages.kevin.locator('.present-card', { hasText: CLOAK });
  await expect(card).toBeVisible();
  await expect(pages.kevin.getByText(SECRET)).toHaveCount(0);
  await pages.kevin.screenshot({ path: 'output/screens/guessing-receiver.png', fullPage: true });
  await card.getByLabel('Who gave this?').selectOption({ label: 'Kate' });
  await card.getByRole('button', { name: 'Save guess' }).click();
  await expect(pages.kevin.getByRole('status')).toContainText('Guess saved: Kate');
  expect(leaks, 'the gift name reached Kevin’s browser before he unwrapped it').toEqual([]);

  revealed = true;
  await pages.kevin.locator('.present-card', { hasText: CLOAK }).getByRole('button', { name: 'Unwrap it' }).click();
  await confirm(pages.kevin, 'Unwrap it');
  const opened = pages.kevin.locator('.present-card', { hasText: CLOAK });
  await expect(opened).toContainText(SECRET);
  await expect(opened).toContainText('From Peter.');
  await expect(opened).toContainText('You guessed Kate.');
  // Control: the same watcher does see the name once it's allowed, so the
  // empty \`leaks\` above is a real result.
  await expect.poll(() => seenAfterReveal).toBeGreaterThan(0);

  // Kate reveals everything; Peter sees the full table.
  await pages.kate.reload();
  await pages.kate.getByRole('button', { name: 'Reveal everything' }).click();
  await confirm(pages.kate, 'Reveal everything');
  // Wait for the change to land before Peter looks (CI runners are slower).
  await expect(pages.kate.locator('.stage-badge')).toHaveText('complete');
  await pages.peter.reload();
  const row = pages.peter.getByRole('table', { name: 'All gifts' }).getByRole('row', { name: new RegExp(SECRET) });
  await expect(row).toContainText('Peter');
  await expect(row).toContainText('Kevin');
  await expect(row).toContainText('Fooled');
  await pages.peter.screenshot({ path: 'output/screens/complete.png', fullPage: true });
});
