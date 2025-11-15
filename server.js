const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const delay = ms => new Promise(r => setTimeout(r, ms));

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q obrigatório' });

  let cars = [];

  try {
    // OLX primeiro (funciona 100%)
    console.log('Tentando OLX...');
    cars = await scrapeOLX(q);
    if (cars.length > 0) {
      console.log(`OLX OK: ${cars.length} carros`);
    } else {
      console.log('OLX falhou, tentando Webmotors...');
      cars = await scrapeWebmotors(q);
    }
  } catch (error) {
    console.error('Erro geral:', error.message);
  }

  // ADICIONA ID ÚNICO
  const resultsWithId = cars.map((c, i) => ({ ...c, id: `car-${i}` }));

  res.json({ results: resultsWithId });
});

// OLX ATUALIZADO (seletor do HTML 2025)
async function scrapeOLX(q) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const url = `https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios?q=${encodeURIComponent(q)}`;
  console.log('OLX URL:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(5000);

  const cars = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid="listing-card"]')).map(el => {
      const a = el.querySelector('a');
      const title = a?.getAttribute('title') || '';
      const price = el.querySelector('[data-testid="ad-price"]')?.innerText || '';
      const loc = el.querySelector('[data-testid="ad-location"]')?.innerText || '';
      const link = a?.href || '';
      return { title, price, km: '', year: '', loc, link, source: 'OLX' };
    }).filter(c => c.title && c.price).slice(0, 10);
  });

  await browser.close();
  return cars;
}

// Webmotors fallback (com delay maior)
async function scrapeWebmotors(q) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(60000);

  const encodedQ = encodeURIComponent(q);
  const url = `https://www.webmotors.com.br/carros?autocomplete=${encodedQ}&autocompleteTerm=${encodedQ}&tipoveiculo=carros&marca1=${q.toUpperCase()}`;
  console.log('Webmotors URL:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(10000);

  const cars = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/comprar/"]')).map(a => {
      const img = a.querySelector('img');
      const title = img?.title || img?.alt || '';
      const price = a.querySelector('.price, [class*="price"]')?.innerText || '';
      const km = a.querySelector('.km, [class*="km"]')?.innerText || '';
      const year = a.querySelector('.year, [class*="year"]')?.innerText || '';
      const loc = a.querySelector('.location, [class*="location"]')?.innerText || '';
      return { title, price, km, year, loc, link: a.href, source: 'Webmotors' };
    }).filter(c => c.title && c.price).slice(0, 10);
  });

  await browser.close();
  return cars;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`));
