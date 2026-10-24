
import { scrapeCambridge, scrapeCambridgeLearner, scrapeYahoo, scrapeGoogleTranslate } from './services/scrapers.js';

// Helper to detect Chinese characters
const isChinese = (text) => /[\u4e00-\u9fa5]/.test(text);

// Translate Chinese to English using Google Translate API
const translateToEnglish = async (text) => {
  try {
    const clients = ['dict-chrome-ex', 'gtx'];
    let data = null;

    for (const client of clients) {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=${client}&sl=zh-TW&tl=en&dt=t&dt=bd&q=${encodeURIComponent(text)}`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          }
        });
        if (response.ok) {
          data = await response.json();
          break;
        }
      } catch {
        // try next client
      }
    }

    if (!data) return null;

    // data[0][0][0] is the primary translated text
    const primary = data[0]?.[0]?.[0];

    if (!primary) return null;

    // data[1] contains dictionary entries/alternatives
    // Structure: [ [ "noun", [ "apple", ... ], ... ] ]
    const alternatives = [];
    if (data[1] && Array.isArray(data[1])) {
      data[1].forEach(block => {
        if (Array.isArray(block[1])) {
          block[1].forEach(word => {
            if (word && word.toLowerCase() !== primary.toLowerCase()) {
              alternatives.push(word);
            }
          });
        }
      });
    }

    // Filter unique and limit
    const uniqueAlternatives = [...new Set(alternatives)].slice(0, 8); // Limit to 8 suggestions

    return {
      word: primary,
      alternatives: uniqueAlternatives
    };

  } catch (error) {
    console.warn("Translation failed", error);
    return null;
  }
};

export default async function handler(req, res) {
  // 處理 CORS (允許你的前端存取)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  /* 
    Updated to support multiple sources.
    Default: Cambridge
    Options: Cambridge, Yahoo
  */
  const { word, source = 'Cambridge', targetLang = 'zh-TW' } = req.query;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  try {
    let searchWord = word;
    let originalQuery = null;
    let alternatives = [];

    // Smart Translation Logic: If input is Chinese, translate to English first
    if (isChinese(word)) {
      const result = await translateToEnglish(word);
      if (result && result.word) {
        originalQuery = word;
        searchWord = result.word;
        alternatives = result.alternatives || [];
      }
    }

    let result = null;

    if (source === 'Yahoo') {
      result = await scrapeYahoo(searchWord);
    } else if (source === 'Google Translate') {
      result = await scrapeGoogleTranslate(searchWord);
    } else if (source === 'Cambridge Learner' || source === "Cambridge Learner's") {
      result = await scrapeCambridgeLearner(searchWord);
    } else {
      // Default to Cambridge
      result = await scrapeCambridge(searchWord, targetLang);
    }

    if (!result) {
      // If translated search failed, maybe try Google Translate directly on the original Chinese word?
      // But usually looking up "Apple" in Cambridge is what we want.
      return res.status(404).json({ error: `Word not found in ${source} Dictionary`, searchedWord: searchWord });
    }

    // Attach original query info if translation happened
    if (originalQuery) {
      result.originalQuery = originalQuery;
      result.translatedFrom = originalQuery;
      result.alternatives = alternatives;
    }

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
}
