const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');

// Fungsi untuk launch browser
async function launchBrowser() {
  return await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
    headless: 'new'
  });
}

// Fungsi untuk scrape ongoing anime
async function scrapeOngoingAnime(page = 1) {
  let browser;
  try {
    browser = await launchBrowser();
    const pageInstance = await browser.newPage();
    
    // Set user agent untuk menghindari blokir
    await pageInstance.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Akses halaman ongoing anime
    const url = page > 1 
      ? `https://otakudesu.best/ongoing-anime/page/${page}/` 
      : 'https://otakudesu.best/ongoing-anime/';
    
    await pageInstance.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Tunggu sampai konten dimuat
    await pageInstance.waitForSelector('.venz > ul > li', { timeout: 10000 });
    
    // Ekstrak data anime
    const animeData = await pageInstance.evaluate(() => {
      const animeList = [];
      const items = document.querySelectorAll('.venz > ul > li');
      
      items.forEach(item => {
        const title = item.querySelector('.jdlflm')?.textContent.trim() || '';
        const image = item.querySelector('img')?.src || '';
        const episode = item.querySelector('.epz')?.textContent.trim() || '';
        const day = item.querySelector('.epztipe')?.textContent.trim() || '';
        const url = item.querySelector('a')?.href || '';
        
        // Ekstrak ID dari URL
        const idMatch = url.match(/anime\/(.+?)\//);
        const id = idMatch ? idMatch[1] : '';
        
        animeList.push({ id, title, image, episode, day, url });
      });
      
      return animeList;
    });
    
    // Cek pagination
    const paginationInfo = await pageInstance.evaluate(() => {
      const pagination = document.querySelector('.pagenavix');
      if (!pagination) return { totalPages: 1, currentPage: 1 };
      
      const pageLinks = pagination.querySelectorAll('.page-numbers');
      const currentPage = pagination.querySelector('.current')?.textContent || '1';
      
      let totalPages = 1;
      if (pageLinks.length > 0) {
        // Ambil angka terakhir dari pagination (biasanya angka sebelum "Berikutnya")
        const lastPage = parseInt(pageLinks[pageLinks.length - 2]?.textContent) || 1;
        totalPages = lastPage;
      }
      
      return { totalPages: parseInt(totalPages), currentPage: parseInt(currentPage) };
    });
    
    await browser.close();
    
    return {
      anime: animeData,
      pagination: paginationInfo
    };
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

// Fungsi untuk scrape hasil pencarian
async function scrapeSearchResults(query) {
  let browser;
  try {
    browser = await launchBrowser();
    const pageInstance = await browser.newPage();
    
    await pageInstance.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Akses halaman pencarian
    const searchUrl = `https://otakudesu.best/?s=${encodeURIComponent(query)}&post_type=anime`;
    await pageInstance.goto(searchUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Tunggu sampai konten dimuat
    await pageInstance.waitForSelector('.chivsrc', { timeout: 10000 });
    
    // Ekstrak hasil pencarian
    const searchData = await pageInstance.evaluate(() => {
      const results = [];
      const items = document.querySelectorAll('.chivsrc > li');
      
      items.forEach(item => {
        const title = item.querySelector('h2 a')?.textContent.trim() || '';
        const image = item.querySelector('img')?.src || '';
        const genres = Array.from(item.querySelectorAll('.set:first-child a')).map(a => a.textContent.trim());
        const status = item.querySelector('.set:nth-child(2)')?.textContent.replace('Status :', '').trim() || '';
        const rating = item.querySelector('.set:nth-child(3)')?.textContent.replace('Rating :', '').trim() || '';
        const url = item.querySelector('h2 a')?.href || '';
        
        // Ekstrak ID dari URL
        const idMatch = url.match(/anime\/(.+?)\//);
        const id = idMatch ? idMatch[1] : '';
        
        results.push({ id, title, image, genres, status, rating, url });
      });
      
      return results;
    });
    
    await browser.close();
    return searchData;
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

// Fungsi untuk scrape detail anime
async function scrapeAnimeDetail(animeId) {
  let browser;
  try {
    browser = await launchBrowser();
    const pageInstance = await browser.newPage();
    
    await pageInstance.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Akses halaman detail anime
    const animeUrl = `https://otakudesu.best/anime/${animeId}/`;
    await pageInstance.goto(animeUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Tunggu sampai konten dimuat
    await pageInstance.waitForSelector('.fotoanime', { timeout: 10000 });
    
    // Ekstrak detail anime
    const animeDetail = await pageInstance.evaluate(() => {
      const title = document.querySelector('.jdlrx h1')?.textContent.trim() || '';
      const image = document.querySelector('.fotoanime img')?.src || '';
      const synopsis = document.querySelector('.sinopc')?.textContent.trim() || '';
      
      // Ekstrak informasi lainnya
      const infoItems = document.querySelectorAll('.infozingle p');
      let status = '', type = '', episode = '', aired = '', genre = '', score = '';
      
      infoItems.forEach(item => {
        const text = item.textContent;
        if (text.includes('Status')) status = text.replace('Status :', '').trim();
        if (text.includes('Type')) type = text.replace('Type :', '').trim();
        if (text.includes('Episode')) episode = text.replace('Total Episode :', '').trim();
        if (text.includes('Aired')) aired = text.replace('Aired :', '').trim();
        if (text.includes('Genres')) genre = text.replace('Genres :', '').trim();
        if (text.includes('Score')) score = text.replace('Score :', '').trim();
      });
      
      // Ekstrak daftar episode
      const episodes = [];
      const episodeItems = document.querySelectorAll('.episodelist li');
      
      episodeItems.forEach(item => {
        const number = item.querySelector('.leftoff')?.textContent.replace('Episode', '').trim() || '';
        const title = item.querySelector('.lefttitle')?.textContent.trim() || '';
        const date = item.querySelector('.zeebr')?.textContent.trim() || '';
        const url = item.querySelector('a')?.href || '';
        
        episodes.push({ number, title, date, url });
      });
      
      return {
        title,
        image,
        synopsis,
        status,
        type,
        episode,
        aired,
        genre: genre.split(', '),
        score,
        episodes
      };
    });
    
    await browser.close();
    return animeDetail;
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

module.exports = {
  scrapeOngoingAnime,
  scrapeSearchResults,
  scrapeAnimeDetail
};
