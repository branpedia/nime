const express = require('express');
const cors = require('cors');
const cloudscraper = require('cloudscraper');
const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Fungsi untuk scraping dengan Cloudscraper
async function scrapeWithCloudscraper(url) {
    try {
        const html = await cloudscraper.get(url);
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        return parseAnimeData(document);
    } catch (error) {
        console.error('Cloudscraper error:', error);
        throw error;
    }
}

// Fungsi untuk scraping dengan Puppeteer
async function scrapeWithPuppeteer(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Set user agent untuk menghindari blokir
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Tunggu sampai konten dimuat
        await page.waitForSelector('.venz > ul > li', { timeout: 10000 });
        
        const html = await page.content();
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        await browser.close();
        
        return parseAnimeData(document);
    } catch (error) {
        if (browser) await browser.close();
        console.error('Puppeteer error:', error);
        throw error;
    }
}

// Fungsi untuk parsing data anime
function parseAnimeData(document) {
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
    
    // Cek pagination
    const pagination = document.querySelector('.pagenavix');
    let totalPages = 1;
    let currentPage = 1;
    
    if (pagination) {
        const currentPageElement = pagination.querySelector('.current');
        currentPage = currentPageElement ? parseInt(currentPageElement.textContent) : 1;
        
        const pageLinks = pagination.querySelectorAll('.page-numbers');
        if (pageLinks.length > 0) {
            // Ambil angka terakhir dari pagination (biasanya angka sebelum "Berikutnya")
            const lastPage = parseInt(pageLinks[pageLinks.length - 2]?.textContent) || 1;
            totalPages = lastPage;
        }
    }
    
    return {
        anime: animeList,
        pagination: { totalPages, currentPage }
    };
}

// Endpoint untuk scraping
app.post('/api/scrape', async (req, res) => {
    try {
        const { method, url } = req.body;
        
        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }
        
        let data;
        
        switch (method) {
            case 'cloudscraper':
                data = await scrapeWithCloudscraper(url);
                break;
            case 'puppeteer':
                data = await scrapeWithPuppeteer(url);
                break;
            case 'puppeteer-core':
                data = await scrapeWithPuppeteer(url);
                break;
            default:
                return res.status(400).json({ success: false, error: 'Invalid method' });
        }
        
        res.json({ success: true, data });
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
