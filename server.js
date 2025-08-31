// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Route untuk mencari anime
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const searchUrl = `https://otakudesu.best/?s=${encodeURIComponent(query)}&post_type=anime`;
    
    const { data } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    
    const results = [];
    
    // Mencari elemen yang mengandung hasil pencarian
    $('li').each((i, el) => {
      const titleElement = $(el).find('h2 a');
      const title = titleElement.text();
      const image = $(el).find('img').attr('src');
      const url = titleElement.attr('href');
      
      if (title && image && url) {
        // Extract details from the element
        const genres = [];
        $(el).find('.set a').each((i, genreEl) => {
          genres.push($(genreEl).text());
        });
        
        let status = '';
        let rating = '';
        
        $(el).find('.set').each((i, detailEl) => {
          const text = $(detailEl).text();
          if (text.includes('Status')) {
            status = text.replace('Status :', '').trim();
          } else if (text.includes('Rating')) {
            rating = text.replace('Rating :', '').trim();
          }
        });
        
        // Extract ID from URL
        const id = url.split('/').filter(Boolean).pop();
        
        results.push({
          id,
          title,
          image,
          url,
          genres,
          status,
          rating,
          episodeCount: 0 // Will be updated from detail
        });
      }
    });
    
    // Jika tidak ada hasil dari selector biasa, coba selector alternatif
    if (results.length === 0) {
      $('.chivsrc li').each((i, el) => {
        const titleElement = $(el).find('h2 a');
        const title = titleElement.text();
        const image = $(el).find('img').attr('src');
        const url = titleElement.attr('href');
        
        if (title && image && url) {
          const genres = [];
          $(el).find('.set a').each((i, genreEl) => {
            genres.push($(genreEl).text());
          });
          
          let status = '';
          let rating = '';
          
          $(el).find('.set').each((i, detailEl) => {
            const text = $(detailEl).text();
            if (text.includes('Status')) {
              status = text.replace('Status :', '').trim();
            } else if (text.includes('Rating')) {
              rating = text.replace('Rating :', '').trim();
            }
          });
          
          const id = url.split('/').filter(Boolean).pop();
          
          results.push({
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
    }
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search anime' });
  }
});

// Route untuk mendapatkan detail anime
app.get('/api/anime/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const animeUrl = `https://otakudesu.best/anime/${id}/`;
    
    const { data } = await axios.get(animeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    
    // Extract anime details
    const title = $('.venser .jdlrx h1').text().replace('Subtitle Indonesia', '').trim();
    const image = $('.fotoanime img').attr('src');
    
    // Extract metadata
    const metadata = {};
    $('.infozingle p span').each((i, el) => {
      const key = $(el).find('b').text().replace(':', '').trim();
      const value = $(el).contents().not('b').text().trim();
      if (key && value) {
        metadata[key.toLowerCase()] = value;
      }
    });
    
    // Extract synopsis
    const synopsis = $('.sinopc').text().trim();
    
    // Extract episodes
    const episodes = [];
    $('.episodelist ul li').each((i, el) => {
      const episodeText = $(el).find('a').text();
      const episodeUrl = $(el).find('a').attr('href');
      const date = $(el).find('.zeebr').text().trim();
      
      if (episodeText && episodeUrl) {
        const episodeNumberMatch = episodeText.match(/Episode (\d+)/);
        const number = episodeNumberMatch ? parseInt(episodeNumberMatch[1]) : i + 1;
        
        episodes.push({
          number,
          title: episodeText,
          date,
          url: episodeUrl
        });
      }
    });
    
    res.json({
      id,
      title,
      image,
      ...metadata,
      synopsis,
      episodes: episodes.reverse() // Reverse to show from episode 1
    });
  } catch (error) {
    console.error('Anime detail error:', error);
    res.status(500).json({ error: 'Failed to fetch anime details' });
  }
});

// Route untuk mendapatkan URL streaming
app.get('/api/stream', async (req, res) => {
  try {
    const { url } = req.query;
    
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    
    // Extract streaming URL (this is a simplified example)
    // Actual implementation would need to handle the specific iframe structure
    let streamingUrl = '';
    $('iframe').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('desustream')) {
        streamingUrl = src;
      }
    });
    
    if (!streamingUrl) {
      // Fallback to a default or handle error
      streamingUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ'; // Placeholder
    }
    
    res.json({ streamingUrl });
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Failed to get streaming URL' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
