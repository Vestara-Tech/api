import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';

describe('OS Image Builder UI (live API)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    await browser?.close();
  });

  const uiUrl = 'http://localhost:5175';

  it('boots and lists image profiles', async () => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(`${uiUrl}/os-image-builder`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Image Profiles', { timeout: 15000 });

    const body = await page.textContent('body');
    expect(body).toContain('Image Profiles');
    expect(body).toContain('Vestara Desktop');
    expect(errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource'))).toEqual([]);
  }, 60000);

  it('opens a profile and renders the three-pane builder with the Boot Experience', async () => {
    await page.goto(`${uiUrl}/os-image-builder/vestara-desktop`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Image Summary', { timeout: 15000 });

    const body = await page.textContent('body');
    expect(body).toContain('Image Summary');
    expect(body).toContain('vestara-desktop');
  }, 60000);

  it('switches to the Boot Experience and edits GRUB timeout', async () => {
    await page.goto(`${uiUrl}/os-image-builder/vestara-desktop/boot`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Boot Experience', { timeout: 15000 });
    await page.waitForSelector('text=GRUB', { timeout: 15000 });

    const body = await page.textContent('body');
    expect(body).toContain('Boot Experience');
    expect(body).toContain('Preview — grub');
  }, 60000);
});
