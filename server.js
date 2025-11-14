const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q obrigatório' });

  try {
    console.log('Iniciando Puppeteer...');
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
    console.log('Browser iniciado! Versão:', await browser.version());

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);  // 60s global

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36');

    // URL CORRETA: Busca real com params (marca, tipo, localização)
    const encodedQ = encodeURIComponent(q);
    const url = `https://www.webmotors.com.br/carros?autocomplete=${encodedQ}&autocompleteTerm=${encodedQ}&tipoveiculo=carros&marca1=${q.toUpperCase()}`;
    console.log('Navegando para:', url);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // ESPERA EXTRA: Aguarda os cards carregarem (JS dinâmico)
    await page.waitForSelector('.result-item, [data-testid="result-item"], .card-item', { timeout: 30000 });
    console.log('Cards carregados!');

    const cars = await page.evaluate(() => {
      // Seletores atualizados (flexíveis pro Webmotors 2025)
      const items = document.querySelectorAll('.result-item, [data-testid="result-item"], .card-item, .sc-aphcUG');
      return Array.from(items).map(el => {
        const title = el.querySelector('h2, .title, [data-testid="title"]')?.innerText?.trim() || '';
        const price = el.querySelector('[data-testid="price"], .price, .sc-bczRLJ')?.innerText?.trim() || '';
        const km = el.querySelector('[data-testid="km"], .km, .sc-jSMfEi')?.innerText?.trim() || '';
        const year = el.querySelector('[data-testid="year"], .year, .sc-kDvujY')?.innerText?.trim() || '';
        const loc = el.querySelector('[data-testid="location"], .location, .sc-dIouRR')?.innerText?.trim() || '';
        const link = el.querySelector('a')?.href || el.querySelector('a')?.getAttribute('href') || '';
        return { title, price, km, year, loc, link, source: 'Webmotors' };
      }).filter(c => c.title).slice(0, 10);  // Limita a 10
    });

    await browser.close();
    console.log(`Scraping concluído: ${cars.length} carros encontrados`);
    res.json({ results: cars });
  } catch (error) {
    console.error('Erro no scraping:', error.message);
    res.json({ results: [] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
