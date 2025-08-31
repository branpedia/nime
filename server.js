import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Launch browser function dengan Chromium untuk production
async function launchBrowser() {
  return await puppeteer.launch({
    args: process.env.NODE_ENV === 'production' ? chromium.args : [],
    executablePath: process.env.NODE_ENV === 'production' 
      ? await chromium.executablePath()
      : process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : process.platform === 'darwin'
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
          : '/usr/bin/google-chrome',
    headless: true,
  });
}

// Route untuk mencari anime
app.get('/api/search', async (req, res) => {
  let browser = null;
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const searchUrl = `https://otakudesu.best/?s=${encodeURIComponent(query)}&post_type=anime`;
    
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    // Set user agent untuk menghindari deteksi bot
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Handle Cloudflare challenge jika ada
    page.on('response', async (response) => {
      if (response.url().includes('cdn-cgi/challenge-platform')) {
        console.log('Cloudflare challenge detected, waiting...');
        await page.waitForTimeout(5000);
      }
    });
    
    console.log('Navigating to:', searchUrl);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Tunggu hingga konten dimuat
    await page.waitForSelector('li', { timeout: 10000 });
    
    const results = await page.evaluate(() => {
      const items = [];
      
      // Cari elemen dengan class chivsrc (untuk hasil pencarian Otakudesu)
      const listElements = document.querySelectorAll('.chivsrc li, li');
      
      listElements.forEach(li => {
        const titleElement = li.querySelector('h2 a');
        const imageElement = li.querySelector('img');
        
        if (titleElement && imageElement) {
          const title = titleElement.textContent;
          const image = imageElement.src;
          const url = titleElement.href;
          
          const genres = [];
          const genreElements = li.querySelectorAll('.set a');
          genreElements.forEach(genreEl => genres.push(genreEl.textContent));
          
          let status = '';
          let rating = '';
          
          const detailElements = li.querySelectorAll('.set');
          detailElements.forEach(detailEl => {
            const text = detailEl.textContent;
            if (text.includes('Status')) {
              status = text.replace('Status :', '').trim();
            } else if (text.includes('Rating')) {
              rating = text.replace('Rating :', '').trim();
            }
          });
          
          const id = url.split('/').filter(Boolean).pop();
          
          items.push({
            id,
            title,
            image,
            url,
            genres,
            status,
            rating,
            episodeCount: 0
          });
        }
      });
      
      return items;
    });
    
    await browser.close();
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Failed to search anime' });
  }
});

// Route untuk mendapatkan detail anime
app.get('/api/anime/:id', async (req, res) => {
  let browser = null;
  try {
    const { id } = req.params;
    const animeUrl = `https://otakudesu.best/anime/${id}/`;
    
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('Navigating to anime detail:', animeUrl);
    await page.goto(animeUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Tunggu hingga konten dimuat
    await page.waitForSelector('.venser', { timeout: 10000 });
    
    const animeDetail = await page.evaluate(() => {
      const titleElement = document.querySelector('.venser .jdlrx h1');
      const title = titleElement ? titleElement.textContent.replace('Subtitle Indonesia', '').trim() : '';
      
      const imageElement = document.querySelector('.fotoanime img');
      const image = imageElement ? imageElement.src : '';
      
      // Extract metadata
      const metadata = {};
      const metaElements = document.querySelectorAll('.infozingle p span');
      metaElements.forEach(el => {
        const keyElement = el.querySelector('b');
        if (keyElement) {
          const key = keyElement.textContent.replace(':', '').trim();
          const value = el.textContent.replace(keyElement.textContent, '').trim();
          if (key && value) {
            metadata[key.toLowerCase()] = value;
          }
        }
      });
      
      // Extract synopsis
      const synopsisElement = document.querySelector('.sinopc');
      const synopsis = synopsisElement ? synopsisElement.textContent.trim() : '';
      
      // Extract episodes
      const episodes = [];
      const episodeElements = document.querySelectorAll('.episodelist ul li');
      
      episodeElements.forEach(li => {
        const linkElement = li.querySelector('a');
        const dateElement = li.querySelector('.zeebr');
        
        if (linkElement) {
          const episodeText = linkElement.textContent;
          const episodeUrl = linkElement.href;
          const date = dateElement ? dateElement.textContent.trim() : '';
          
          const episodeNumberMatch = episodeText.match(/Episode (\d+)/);
          const number = episodeNumberMatch ? parseInt(episodeNumberMatch[1]) : episodes.length + 1;
          
          episodes.push({
            number,
            title: episodeText,
            date,
            url: episodeUrl
          });
        }
      });
      
      return {
        title,
        image,
        ...metadata,
        synopsis,
        episodes: episodes.reverse()
      };
    });
    
    await browser.close();
    
    res.json({
      id,
      ...animeDetail
    });
  } catch (error) {
    console.error('Anime detail error:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Failed to fetch anime details' });
  }
});

// Route untuk mendapatkan URL streaming
app.get('/api/stream', async (req, res) => {
  let browser = null;
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('Navigating to episode:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Tunggu hingga pemutar video dimuat
    await page.waitForSelector('iframe', { timeout: 10000 });
    
    const streamingData = await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      return {
        streamingUrl: iframe ? iframe.src : ''
      };
    });
    
    await browser.close();
    
    // Fallback jika tidak menemukan iframe
    if (!streamingData.streamingUrl) {
      streamingData.streamingUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ'; // Placeholder
    }
    
    res.json(streamingData);
  } catch (error) {
    console.error('Stream error:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Failed to get streaming URL' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
