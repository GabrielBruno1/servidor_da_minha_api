const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

const delay = ms => new Promise(r => setTimeout(r, ms));

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q obrigatório' });

  let cars = [];

  // TENTA WEBMOTORS COM STEALTH
  try {
    console.log('Tentando Webmotors com Stealth...');
    cars = await scrapeWebmotors(q);
    if (cars.length > 0) {
      console.log(`Webmotors OK: ${cars.length} carros`);
    }
  } catch (e) {
    console.log('Webmotors falhou, indo pra OLX...');
  }

  // FALLBACK OLX
  if (cars.length === 0) {
    cars = await scrapeOLX(q);
    console.log(`OLX OK: ${cars.length} carros`);
  }

  const resultsWithId = cars.map((c, i) => ({ ...c, id: `car-${i}` }));
  res.json({ results: resultsWithId });
});

// WEBMOTORS COM STEALTH
async function scrapeWebmotors(q) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();

  // STEALTH: Remove sinais de bot
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36');
  
  const url = `https://www.webmotors.com.br/carros/${encodeURIComponent(q)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(8000);

  const cars = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/comprar/"]')).map(a => {
      const img = a.querySelector('img');
      const title = img?.title || img?.alt || '';
      const price = a.querySelector('[data-testid="price"]')?.innerText || '';
      const km = a.querySelector('[data-testid="km"]')?.innerText || '';
      const year = a.querySelector('[data-testid="year"]')?.innerText || '';
      const loc = a.querySelector('[data-testid="location"]')?.innerText || '';
      return { title, price, km, year, loc, link: a.href, source: 'Webmotors' };
    }).filter(c => c.title).slice(0, 10);
  });

  await browser.close();
  return cars;
}

// OLX (fallback)
async function scrapeOLX(q) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios?q=${q}`, { waitUntil: 'domcontentloaded' });
  await delay(5000);

  const cars = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid="listing-card"]')).map(el => {
      const a = el.querySelector('a');
      return {
        title: a?.getAttribute('title') || '',
        price: el.querySelector('[data-testid="ad-price"]')?.innerText || '',
        loc: el.querySelector('[data-testid="ad-location"]')?.innerText || '',
        link: a?.href || '',
        km: '', year: '', source: 'OLX'
      };
    }).filter(c => c.title && c.price).slice(0, 10);
  });

  await browser.close();
  return cars;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
