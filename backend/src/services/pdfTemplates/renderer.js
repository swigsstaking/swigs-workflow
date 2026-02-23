import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function loadCSS() {
  return fs.readFileSync(path.join(__dirname, 'styles', 'invoice.css'), 'utf-8');
}

function compileTemplate(templateName, data) {
  const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
  const templateSource = fs.readFileSync(templatePath, 'utf-8');
  const css = loadCSS();
  const template = Handlebars.compile(templateSource);
  return template({ ...data, css });
}

export function renderHTML(templateName, data) {
  return compileTemplate(templateName, data);
}

export async function renderPDF(templateName, data) {
  const html = compileTemplate(templateName, data);
  const b = await getBrowser();
  let page;
  try {
    page = await b.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' }
    });
    return Buffer.from(pdf);
  } finally {
    if (page) await page.close();
  }
}

// Cleanup on process exit
process.on('exit', () => {
  if (browser) browser.close();
});
