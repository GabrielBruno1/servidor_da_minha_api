// server.js
import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;

// Inicia o navegador ao ligar o server
async function startBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/google-chrome-stable', // Android precisa do Chrome
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    });
    console.log('Puppeteer iniciado');
  }
}

// Scraping Webmotors
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q obrigatório' });

  try {
    await startBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10)');

    const url = `https://www.webmotors.com.br/carros/${q.replace(/\s+/g, '-')}`;
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

    await page.close();
    res.json({ results: cars });
  } catch (err) {
    console.error('Erro no scraping:', err.message);
    res.json({ results: [] });
  }
});

// Inicia o server
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor local rodando na porta ${PORT}`);
  console.log(`→ http://localhost:${PORT}/api/search?q=volkswagen gol`);
});

export default app;