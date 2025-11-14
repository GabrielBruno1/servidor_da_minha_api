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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36');

    const url = `https://www.webmotors.com.br/carros/${q.replace(/ /g, '-')}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const cars = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.sc-aphcUG')).map(el => {
        const title = el.querySelector('h2')?.innerText || '';
        const price = el.querySelector('[data-testid="price"]')?.innerText || '';
        const km = el.querySelector('[data-testid="km"]')?.innerText || '';
        const year = el.querySelector('[data-testid="year"]')?.innerText || '';
        const loc = el.querySelector('[data-testid="location"]')?.innerText || '';
        const link = el.querySelector('a')?.href || '';
        return { title, price, km, year, loc, link, source: 'Webmotors' };
      }).filter(c => c.title).slice(0, 10);
    });

    await browser.close();
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
