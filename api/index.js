// api/index.js
const express = require('express');
const puppeteer = require('puppeteer');
const cloudscraper = require('cloudscraper');
const { JSDOM } = require('jsdom');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Endpoint untuk mendapatkan anime ongoing
app.get('/api/ongoing', async (req, res) => {
    try {
        const browser = await puppeteer.launch({ 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        
        // Set user agent untuk menghindari blokir
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Akses halaman ongoing anime
        await page.goto('https://otakudesu.best/ongoing-anime/', { 
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Ekstrak data anime
        const animeData = await page.evaluate(() => {
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
        
        await browser.close();
        
        res.json({ success: true, data: animeData });
    } catch (error) {
        console.error('Error fetching ongoing anime:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint untuk mencari anime
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ success: false, error: 'Query parameter required' });
        }
        
        const browser = await puppeteer.launch({ 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Akses halaman pencarian
        const searchUrl = `https://otakudesu.best/?s=${encodeURIComponent(q)}&post_type=anime`;
        await page.goto(searchUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Ekstrak hasil pencarian
        const searchData = await page.evaluate(() => {
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
        
        res.json({ success: true, data: searchData });
    } catch (error) {
        console.error('Error searching anime:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint untuk mendapatkan detail anime
app.get('/api/anime/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const browser = await puppeteer.launch({ 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Akses halaman detail anime
        const animeUrl = `https://otakudesu.best/anime/${id}/`;
        await page.goto(animeUrl, { 
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // Ekstrak detail anime
        const animeDetail = await page.evaluate(() => {
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
        
        res.json({ success: true, data: animeDetail });
    } catch (error) {
        console.error('Error fetching anime detail:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
