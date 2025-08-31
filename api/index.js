const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');
const { scrapeOngoingAnime, scrapeSearchResults, scrapeAnimeDetail } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 600 }); // Cache 10 menit

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Endpoint untuk mendapatkan anime ongoing
app.get('/api/ongoing', async (req, res) => {
  try {
    const page = req.query.page || 1;
    const cacheKey = `ongoing-${page}`;
    
    // Cek cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, source: 'cache', data: cachedData });
    }
    
    const animeData = await scrapeOngoingAnime(page);
    
    // Simpan ke cache
    cache.set(cacheKey, animeData);
    
    res.json({ success: true, source: 'live', data: animeData });
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
    
    const cacheKey = `search-${q}`;
    
    // Cek cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, source: 'cache', data: cachedData });
    }
    
    const searchData = await scrapeSearchResults(q);
    
    // Simpan ke cache
    cache.set(cacheKey, searchData);
    
    res.json({ success: true, source: 'live', data: searchData });
  } catch (error) {
    console.error('Error searching anime:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint untuk mendapatkan detail anime
app.get('/api/anime/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const cacheKey = `anime-${id}`;
    
    // Cek cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, source: 'cache', data: cachedData });
    }
    
    const animeDetail = await scrapeAnimeDetail(id);
    
    // Simpan ke cache
    cache.set(cacheKey, animeDetail);
    
    res.json({ success: true, source: 'live', data: animeDetail });
  } catch (error) {
    console.error('Error fetching anime detail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint untuk home page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Endpoint untuk search page
app.get('/search', (req, res) => {
  res.sendFile(__dirname + '/public/search.html');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
