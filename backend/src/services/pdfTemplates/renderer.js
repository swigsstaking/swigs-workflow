import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const STYLES_DIR = path.join(__dirname, 'styles');

// Cache compiled templates and CSS at module load time
const templateCache = {};
const styleCache = {};

function loadTemplates() {
  styleCache['invoice'] = fs.readFileSync(path.join(STYLES_DIR, 'invoice.css'), 'utf8');
  for (const name of ['invoice', 'quote', 'reminder']) {
    const src = fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.hbs`), 'utf8');
    templateCache[name] = Handlebars.compile(src);
  }
}

loadTemplates();

let browser = null;

// Register Handlebars helpers
Handlebars.registerHelper('formatCurrency', (amount) => {
  return new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0) + ' CHF';
});

Handlebars.registerHelper('formatDate', (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-CH', { year: 'numeric', month: '2-digit', day: '2-digit' });
});

Handlebars.registerHelper('eq', (a, b) => a === b);

Handlebars.registerHelper('if_eq', function (a, b, options) {
  return a === b ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('multiply', (a, b) => (a || 0) * (b || 0));

Handlebars.registerHelper('gt', (a, b) => a > b);

Handlebars.registerHelper('or', (a, b) => a || b);

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return browser;
}

function compileTemplate(templateName, data) {
  const template = templateCache[templateName];
  if (!template) throw new Error(`Unknown PDF template: ${templateName}`);
  const css = styleCache['invoice'];
  return template({ ...data, css });
}

export function renderHTML(templateName, data) {
  return compileTemplate(templateName, data);
}

let activePdfJobs = 0;
const MAX_CONCURRENT_PDFS = 5;

export async function renderPDF(templateName, data, options = {}) {
  if (activePdfJobs >= MAX_CONCURRENT_PDFS) {
    throw new Error('Too many concurrent PDF jobs. Please try again later.');
  }
  activePdfJobs++;

  const html = compileTemplate(templateName, data);
  const b = await getBrowser();
  let page;
  try {
    page = await b.newPage();

    // Block all external requests — only allow data: URIs (SSRF protection)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().startsWith('data:')) req.continue();
      else req.abort();
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
      timeout: 15000
    });
    const contentBuffer = Buffer.from(pdf);

    // Merge with letterhead PDF if provided
    if (options.letterheadPdf) {
      return await mergeWithLetterhead(contentBuffer, options.letterheadPdf);
    }

    return contentBuffer;
  } finally {
    activePdfJobs--;
    if (page) await page.close();
  }
}

/**
 * Merge content PDF pages over a letterhead PDF background.
 * The letterhead page 1 is used as background for all content pages.
 * @param {Buffer} contentBuffer - Generated invoice/quote PDF
 * @param {string} letterheadBase64 - Base64-encoded letterhead PDF
 * @returns {Promise<Buffer>} Merged PDF buffer
 */
async function mergeWithLetterhead(contentBuffer, letterheadBase64) {
  const letterheadBytes = Buffer.from(letterheadBase64, 'base64');
  const letterheadDoc = await PDFDocument.load(letterheadBytes);
  const contentDoc = await PDFDocument.load(contentBuffer);
  const mergedDoc = await PDFDocument.create();

  const letterheadPage = letterheadDoc.getPages()[0];
  const contentPages = contentDoc.getPages();

  // Embed letterhead once — reuse reference for all pages
  const [embeddedLetterhead] = await mergedDoc.embedPages([letterheadPage]);

  for (let i = 0; i < contentPages.length; i++) {
    const { width, height } = contentPages[i].getSize();
    const newPage = mergedDoc.addPage([width, height]);

    // Draw letterhead background first
    newPage.drawPage(embeddedLetterhead, { x: 0, y: 0, width, height });

    // Overlay content on top
    const [embeddedContent] = await mergedDoc.embedPages([contentPages[i]]);
    newPage.drawPage(embeddedContent, { x: 0, y: 0, width, height });
  }

  const mergedBytes = await mergedDoc.save();
  return Buffer.from(mergedBytes);
}

// Cleanup on process exit
process.on('exit', () => {
  if (browser) browser.close();
});
