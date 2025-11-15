const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q obrigatório' });

  let cars = [];

  try {
    // Tenta Webmotors primeiro
    console.log('Tentando Webmotors...');
    cars = await scrapeWebmotors(q);
    if (cars.length > 0) {
      console.log(`Webmotors OK: ${cars.length} carros`);
    } else {
      console.log('Webmotors falhou, tentando OLX...');
      cars = await scrapeOLX(q);
    }
  } catch (error) {
    console.error('Erro geral:', error.message);
  }

  res.json({ results: cars.slice(0, 10) });
});

// Função para Webmotors (seletor baseado no HTML fornecido)
async function scrapeWebmotors(q) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-features=VizDisplayCompositor',
      '--single-process',
      '--no-zygote'
    ]
  });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(90000);  // 90s global

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36');

  const encodedQ = encodeURIComponent(q);
  const url = `https://www.webmotors.com.br/carros?autocomplete=${encodedQ}&autocompleteTerm=${encodedQ}&tipoveiculo=carros&marca1=${q.toUpperCase()}`;
  console.log('Navegando para Webmotors:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // DELAY MAIOR: 10s pra JS carregar anúncios
  await page.waitForTimeout(10000);
  console.log('Delay 10s concluído, rolando página pra lazy load...');

  // SCROLL: Simula scroll pra carregar mais cards (Webmotors usa lazy loading)
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 2);
  });
  await page.waitForTimeout(3000);  // 3s após scroll

  // Aguarda seletor exato do card (baseado no HTML que você mandou)
  try {
    await page.waitForSelector('div[class*="_Head_"]', { timeout: 30000 });
    console.log('Cards _Head_ carregados!');
  } catch (e) {
    console.log('Seletor _Head_ não encontrado, tentando genérico...');
  }

  const cars = await page.evaluate(() => {
    // Seletor EXATO: div._Head_1it3m_1 ou similar (classes CSS modules)
    const items = document.querySelectorAll('div[class*="_Head_"], div[class*="_Container_nv1r7_"], [class*="result-item"]');
    return Array.from(items).map(el => {
      const a = el.querySelector('a[target="_blank"][rel="nofollow"]');  // Link principal
      const link = a?.href || '';
      const img = a?.querySelector('img');  // Imagem com title/alt como título
      const title = img?.title || img?.alt || el.querySelector('h2, .title, [class*="title"]')?.innerText?.trim() || '';
      const price = el.querySelector('.price, [class*="price"], [data-testid*="price"], ._Price_')?.innerText?.trim() || '';
      const km = el.querySelector('.km, [class*="km"], [data-testid*="km"]')?.innerText?.trim() || '';
      const year = el.querySelector('.year, [class*="year"], [data-testid*="year"]')?.innerText?.trim() || '';
      const loc = el.querySelector('.location, [class*="location"], [data-testid*="location"]')?.innerText?.trim() || el.querySelector('[class*="_MetadataWrapper_"]')?.innerText?.trim() || '';
      return { title, price, km, year, loc, link, source: 'Webmotors' };
    }).filter(c => c.title && c.link).slice(0, 10);  // Só com título e link
  });

  await browser.close();
  return cars;
}

// Fallback: Scraping OLX (mantido, funciona bem)
async function scrapeOLX(q) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(60000);

  const url = `https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios?q=${encodeURIComponent(q)}`;
  console.log('Navegando para OLX:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.waitForTimeout(5000);  // Delay pra OLX

  const cars = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-testid="listing-card"], .offer-item, .sc-1k8mkkj-0');
    return Array.from(items).map(el => {
      const a = el.querySelector('a');
      const title = a?.getAttribute('title')?.trim() || a?.innerText?.trim() || '';
      const price = el.querySelector('[data-testid="ad-price"], .price')?.innerText?.trim() || '';
      const loc = el.querySelector('[data-testid="ad-location"], .location')?.innerText?.trim() || '';
      const link = a?.href || '';
      return { title, price, '', '', loc, link, source: 'OLX' };  // Km/ano vazios na OLX
    }).filter(c => c.title && c.price).slice(0, 10);
  });

  await browser.close();
  return cars;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
