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
// No início do try, adicione:
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
console.log('Browser iniciado com sucesso!');

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const url = `https://www.webmotors.com.br/carros/${q.replace(/ /g, '-')}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const cars = await page.evaluate(() => {
      const elements = document.querySelectorAll('.sc-aphcUG');  // Seletor Webmotors (atualizado 2025)
      return Array.from(elements).map(el => {
        const title = el.querySelector('h2')?.innerText?.trim() || '';
        const price = el.querySelector('[data-testid="price"]')?.innerText?.trim() || el.querySelector('.price')?.innerText?.trim() || '';
        const km = el.querySelector('[data-testid="km"]')?.innerText?.trim() || el.querySelector('.km')?.innerText?.trim() || '';
        const year = el.querySelector('[data-testid="year"]')?.innerText?.trim() || el.querySelector('.year')?.innerText?.trim() || '';
        const loc = el.querySelector('[data-testid="location"]')?.innerText?.trim() || el.querySelector('.location')?.innerText?.trim() || '';
        const link = el.querySelector('a')?.href || '';
        return { title, price, km, year, loc, link, source: 'Webmotors' };
      }).filter(c => c.title).slice(0, 10);  // Limita a 10 resultados
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
