const express = require('express');
const cloudscraper = require('cloudscraper');
const puppeteer = require('puppeteer');
const cors = require('cors');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint untuk ongoing anime dengan Cloudscraper
app.get('/api/ongoing-anime', async (req, res) => {
  try {
    console.log('Mengambil data dengan Cloudscraper...');
    
    const url = 'https://otakudesu.best/ongoing-anime/';
    const html = await cloudscraper.get(url);
    
    // Parse HTML untuk mengambil data anime
    const animeList = parseAnimeData(html);
    
    res.json({ success: true, data: animeList });
  } catch (error) {
    console.error('Cloudscraper error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint untuk ongoing anime dengan Puppeteer (fallback)
app.get('/api/ongoing-anime-puppeteer', async (req, res) => {
  let browser;
  try {
    console.log('Mengambil data dengan Puppeteer...');
    
    browser = await puppeteer.launch({ 
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Set user agent untuk menghindari deteksi
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    const url = 'https://otakudesu.best/ongoing-anime/';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Tunggu sampai konten dimuat
    await page.waitForSelector('.venz > ul > li', { timeout: 10000 });
    
    // Ekstrak HTML
    const html = await page.content();
    
    // Parse HTML untuk mengambil data anime
    const animeList = parseAnimeData(html);
    
    await browser.close();
    res.json({ success: true, data: animeList });
  } catch (error) {
    console.error('Puppeteer error:', error);
    if (browser) await browser.close();
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fungsi untuk parsing data anime dari HTML
function parseAnimeData(html) {
  const animeList = [];
  const $ = cheerio.load(html);
  
  $('.venz > ul > li').each((index, element) => {
    const $el = $(element);
    const title = $el.find('.jdlflm').text().trim();
    const image = $el.find('img').attr('src');
    const episode = $el.find('.epz').text().trim();
    const day = $el.find('.epztipe').text().trim();
    const url = $el.find('a').attr('href');
    
    if (title && image) {
      // Ekstrak ID dari URL
      const idMatch = url.match(/anime\/(.+?)\//);
      const id = idMatch ? idMatch[1] : title.toLowerCase().replace(/\s+/g, '-');
      
      animeList.push({ id, title, image, episode, day, url });
    }
  });
  
  return animeList;
}

// Handle OPTIONS request for CORS
app.options('/api/ongoing-anime', cors());
app.options('/api/ongoing-anime-puppeteer', cors());

// Serve static files
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
