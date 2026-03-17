// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const http = require('http');
const fs = require('fs');

const BV_PAGES_DIR = path.resolve(__dirname, '..', 'bv-pages');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/** Start a simple static file server for bv-pages. */
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
      const filePath = path.join(BV_PAGES_DIR, urlPath);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';

      // Add COOP/COEP headers for SharedArrayBuffer support
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Content-Type', mime);
      res.writeHead(200);
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

let serverInfo;

test.beforeAll(async () => {
  serverInfo = await startServer();
});

test.afterAll(async () => {
  if (serverInfo?.server) {
    serverInfo.server.close();
  }
});

test.describe('Beads Viewer Pages', () => {
  test('loads the bv-pages index and renders beads', async ({ page }) => {
    await page.goto(serverInfo.url);
    await page.waitForLoadState('networkidle');

    // Wait for the app to initialize (Alpine.js + SQLite WASM load)
    await page.waitForTimeout(5000);

    const title = await page.title();
    expect(title).toBeTruthy();

    // The page should have loaded and show bead content
    const content = await page.textContent('body');

    // Check that the viewer rendered with issue content
    // At minimum, the dashboard/issues view should be visible
    expect(content).toContain('Beads Viewer');
  });

  test('displays issue data from the database', async ({ page }) => {
    await page.goto(serverInfo.url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    const bodyText = await page.textContent('body');

    // The export should contain beads related to the poker rewards project
    // Check for known keywords from the issue titles
    const hasRewardsContent = bodyText.includes('Rewards') || bodyText.includes('rewards');
    const hasBeadIds = /p3-/.test(bodyText);
    const hasIssueContent = hasRewardsContent || hasBeadIds;

    expect(hasIssueContent).toBeTruthy();
  });

  test('takes a screenshot for evidence', async ({ page }) => {
    await page.goto(serverInfo.url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: path.resolve(__dirname, '..', 'bv-pages-screenshot.png'),
      fullPage: true,
    });

    // Verify screenshot was created
    expect(fs.existsSync(path.resolve(__dirname, '..', 'bv-pages-screenshot.png'))).toBe(true);
  });
});
