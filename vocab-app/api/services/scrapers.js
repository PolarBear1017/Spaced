import * as cheerio from 'cheerio';
import https from 'node:https';
import dns from 'node:dns';

try {
    dns.setDefaultResultOrder('ipv4first');
} catch {
    // Ignore in environments where not supported
}

const fetchHttpsText = (url, depth = 0) => {
    if (depth > 5) {
        return Promise.resolve({ ok: false, status: 508, text: '' });
    }
    return new Promise((resolve) => {
        const req = https.get(url, {
            family: 4,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 10000
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const nextUrl = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : new URL(res.headers.location, url).toString();
                return resolve(fetchHttpsText(nextUrl, depth + 1));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, text: data }));
        });
        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, status: 408, text: '' });
        });
        req.on('error', (err) => resolve({ ok: false, status: 500, error: err.message, text: '' }));
    });
};

const parseCambridgeHtml = (html, word, source = 'Cambridge') => {
    const $ = cheerio.load(html);

    const isFound = $('.di-title').length > 0 || $('.def-block').length > 0;
    if (!isFound) return null;

    const pos = $('.pos').first().text() || 'unknown';
    const phonetic = $('.us .ipa').first().text() || $('.ipa').first().text() || '';

    const entries = [];
    $('.def-block').each((_, block) => {
        const definitionText = $(block).find('.def').first().text().replace(':', '').trim();

        // Fix: Exclude .trans elements that are inside .examp (examples)
        // The structure is usually .def-body > .trans or .def-block > .trans
        let translationText = $(block).find('.trans')
            .filter((i, el) => $(el).parents('.examp').length === 0)
            .first()
            .text()
            .trim();

        const examples = $(block)
            .find('.examp')
            .map((_, el) => {
                const $el = $(el);
                let collocation = $el.find('.lu').text().trim();
                if (!collocation) {
                    const phraseTitle = $el.closest('.phrase-block, .idiom-block, .pr.phrase').find('.phrase-title, .idiom-title, .idm-title').first().text().trim();
                    if (phraseTitle) {
                        collocation = phraseTitle;
                    }
                }
                const eg = $el.find('.eg').text().trim();
                const trans = $el.find('.trans').text().trim();

                let text = eg;
                if (!text) {
                    const clone = $el.clone();
                    clone.find('.lu, .trans').remove();
                    text = clone.text().trim();
                }
                if (!text) return null;

                const exObj = { text };
                if (trans) exObj.translation = trans;
                if (collocation) exObj.collocation = collocation;
                return exObj;
            })
            .get()
            .filter(Boolean);

        // Smart POS extraction: find the closest POS tag in the hierarchy
        // Usually it's in a previous sibling .pos-header or parent's sibling
        let entryPos = $(block).closest('.entry-body__el').find('.pos').first().text();
        if (!entryPos) entryPos = $(block).closest('.pr').find('.pos').first().text();
        if (!entryPos) entryPos = pos; // Fallback to the top-level POS

        const primaryExample = examples[0]
            ? (typeof examples[0] === 'string' ? examples[0] : (examples[0].translation ? `${examples[0].text}\n${examples[0].translation}` : examples[0].text))
            : '';

        if (definitionText) {
            entries.push({
                definition: definitionText,
                translation: translationText,
                example: primaryExample,
                examples,
                pos: entryPos
            });
        }
    });

    if (entries.length === 0) {
        const definition = $('.def').first().text().replace(':', '').trim();
        const translation = $('.trans').first().text().trim();
        const firstExEl = $('.examp').first();
        let fallbackExampleObj = null;

        if (firstExEl.length > 0) {
            let collocation = firstExEl.find('.lu').text().trim();
            if (!collocation) {
                const phraseTitle = firstExEl.closest('.phrase-block, .idiom-block, .pr.phrase').find('.phrase-title, .idiom-title, .idm-title').first().text().trim();
                if (phraseTitle) {
                    collocation = phraseTitle;
                }
            }
            const eg = firstExEl.find('.eg').text().trim();
            const trans = firstExEl.find('.trans').text().trim();
            let text = eg;
            if (!text) {
                const clone = firstExEl.clone();
                clone.find('.lu, .trans').remove();
                text = clone.text().trim();
            }
            if (text) {
                fallbackExampleObj = { text };
                if (trans) fallbackExampleObj.translation = trans;
                if (collocation) fallbackExampleObj.collocation = collocation;
            }
        }

        if (definition) {
            const fallbackStr = fallbackExampleObj
                ? (fallbackExampleObj.translation ? `${fallbackExampleObj.text}\n${fallbackExampleObj.translation}` : fallbackExampleObj.text)
                : '';
            entries.push({
                definition,
                translation,
                example: fallbackStr,
                examples: fallbackExampleObj ? [fallbackExampleObj] : []
            });
        }
    }

    const usAudioSource = $('.us.dpron-i source[type="audio/mpeg"]').first();
    const ukAudioSource = $('.uk.dpron-i source[type="audio/mpeg"]').first();
    const usAudioUrl = usAudioSource.attr('src')
        ? 'https://dictionary.cambridge.org' + usAudioSource.attr('src')
        : '';
    const ukAudioUrl = ukAudioSource.attr('src')
        ? 'https://dictionary.cambridge.org' + ukAudioSource.attr('src')
        : '';

    if (entries.length === 0) return null;

    return {
        word,
        pos,
        phonetic: phonetic ? `/${phonetic}/` : '',
        definition: entries[0].definition,
        translation: entries[0].translation,
        example: entries[0].example,
        entries,
        audioUrl: usAudioUrl || ukAudioUrl,
        usAudioUrl,
        ukAudioUrl,
        source
    };
};

const fallbackToProduction = async (word, source, targetLang) => {
    const isLocal = process.env.NODE_ENV === 'development' ||
                    process.env.VERCEL_ENV === 'development' ||
                    !process.env.VERCEL ||
                    process.env.VERCEL_URL?.includes('localhost');
    if (!isLocal) return null;

    try {
        const prodApiUrl = process.env.PROD_API_URL || 'https://spaced-vocabulary.vercel.app';
        const targetUrl = `${prodApiUrl}/api/dictionary?word=${encodeURIComponent(word)}&source=${encodeURIComponent(source)}&targetLang=${encodeURIComponent(targetLang || 'zh-TW')}`;
        const res = await fetch(targetUrl, {
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.warn('Fallback to production Cambridge API failed:', e.message);
    }
    return null;
};

export const scrapeCambridge = async (word, targetLang = 'zh-TW') => {
    const isEn = targetLang === 'en';
    const targetUrl = isEn
        ? `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word)}`
        : `https://dictionary.cambridge.org/dictionary/english-chinese-traditional/${encodeURIComponent(word)}`;

    const response = await fetchHttpsText(targetUrl);
    if (!response.ok || !response.text) {
        if (response.status === 403) {
            const fallbackResult = await fallbackToProduction(word, 'Cambridge', targetLang);
            if (fallbackResult) return fallbackResult;
        }
        return null;
    }

    return parseCambridgeHtml(response.text, word, 'Cambridge');
};

export const scrapeCambridgeLearner = async (word) => {
    const targetUrl = `https://dictionary.cambridge.org/dictionary/learner-english/${encodeURIComponent(word)}`;

    const response = await fetchHttpsText(targetUrl);
    if (!response.ok || !response.text) {
        if (response.status === 403) {
            const fallbackResult = await fallbackToProduction(word, 'Cambridge Learner', 'en');
            if (fallbackResult) return fallbackResult;
        }
        return null;
    }

    return parseCambridgeHtml(response.text, word, 'Cambridge Learner');
};

export const scrapeYahoo = async (word) => {
    try {
        const urls = [
            `https://tw.dictionary.search.yahoo.com/search?p=${encodeURIComponent(word)}`,
            `https://tw.dictionary.yahoo.com/dictionary?p=${encodeURIComponent(word)}`
        ];

        let html = null;
        for (const url of urls) {
            const res = await fetchHttpsText(url);
            if (res.ok && res.text && res.text.length > 5000) {
                html = res.text;
                break;
            }
        }

        if (!html) {
            console.error('Yahoo scraper: All endpoints failed or returned empty response');
            return {
                source: 'Yahoo',
                word,
                entries: []
            };
        }

        const $ = cheerio.load(html);
        const entries = [];
        const seenTranslations = new Set();

        // Target the main dictionary card (.dictionaryWordCard)
        const dictionaryCard = $('.dictionaryWordCard').first();

        if (dictionaryCard.length > 0) {
            const listItems = dictionaryCard.find('.compList > ul > li');

            listItems.each((i, el) => {
                const $el = $(el);
                const pos = $el.find('.pos_button').text().trim();
                const defText = $el.find('.dictionaryExplanation').text().trim();

                if (defText) {
                    const meanings = defText.split(';').map(s => s.trim()).filter(Boolean);

                    meanings.forEach(meaning => {
                        const uniqueKey = `${pos}-${meaning}`;

                        if (!seenTranslations.has(uniqueKey)) {
                            seenTranslations.add(uniqueKey);
                            entries.push({
                                definition: '',
                                translation: meaning,
                                example: '',
                                examples: [],
                                pos: pos || 'unknown'
                            });
                        }
                    });
                }
            });
        }

        // Fallback: generic .dd.card if specific structure fails
        if (entries.length === 0) {
            const fallbackCard = $('.dd.card').first();
            if (fallbackCard.length > 0) {
                fallbackCard.find('.compList > ul > li').each((i, el) => {
                    const text = $(el).text().trim();
                    const spaceIdx = text.indexOf(' ');
                    if (spaceIdx > 0) {
                        const pos = text.substring(0, spaceIdx).trim();
                        const def = text.substring(spaceIdx).trim();
                        if (pos && def && !seenTranslations.has(def)) {
                            seenTranslations.add(def);
                            entries.push({
                                definition: '',
                                translation: def,
                                example: '',
                                examples: [],
                                pos: pos || 'unknown'
                            });
                        }
                    }
                });
            }
        }

        let usAudioUrl = '';
        let ukAudioUrl = '';
        let audioUrl = '';

        const audioUrlMatches = html.match(/https:\/\/[\w.-]+\.yimg\.com\/bg\/dict\/[^"]+\.mp3/g);
        if (audioUrlMatches && audioUrlMatches.length > 0) {
            const uniqueAudioUrls = [...new Set(audioUrlMatches)];
            usAudioUrl = uniqueAudioUrls.find(url => url.includes('_us_')) || uniqueAudioUrls[0];
            ukAudioUrl = uniqueAudioUrls.find(url => url.includes('_gb_')) || '';
            audioUrl = usAudioUrl;
        }

        const topTranslation = entries.length > 0 ? entries[0].translation : '';

        return {
            word,
            pos: entries.length > 0 ? entries[0].pos : 'unknown',
            phonetic: '',
            definition: '',
            translation: topTranslation,
            example: '',
            entries,
            audioUrl: audioUrl,
            usAudioUrl: usAudioUrl,
            ukAudioUrl: ukAudioUrl,
            source: 'Yahoo'
        };
    } catch (error) {
        console.warn("Yahoo scraping failed", error);
        return {
            source: 'Yahoo',
            word,
            entries: []
        };
    }
};

export const scrapeGoogleTranslate = async (word) => {
    try {
        const clients = ['dict-chrome-ex', 'gtx'];
        let data = null;

        for (const client of clients) {
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=${client}&sl=en&tl=zh-TW&dt=t&dt=bd&dt=rm&q=${encodeURIComponent(word)}`;
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

        if (!data) {
            console.error('Google Translate API failed on all clients');
            return null;
        }

        // data[0][0][0] contains the primary translation
        let primaryTranslation = data[0]?.[0]?.[0];

        if (!primaryTranslation) {
            return null;
        }

        primaryTranslation = primaryTranslation.trim();

        // Extract phonetic (e.g. data[0][1][3] is English IPA or data[0][1][2])
        const phoneticRaw = data[0]?.[1]?.[3] || data[0]?.[1]?.[2] || '';
        const phonetic = phoneticRaw ? `/${phoneticRaw}/` : '';

        const entries = [];
        const seenTranslations = new Set();

        // 確保最優先的主翻譯不會遺漏，並且放在第一位
        seenTranslations.add(primaryTranslation);
        entries.push({
            definition: '',
            translation: primaryTranslation,
            example: '',
            examples: [],
            pos: 'unknown'
        });

        // data[1] contains distinct parts of speech and their translations
        const extraDefinitions = data[1];

        if (Array.isArray(extraDefinitions)) {
            extraDefinitions.forEach(posBlock => {
                const pos = posBlock[0]; // e.g. "noun"
                const terms = posBlock[1]; // e.g. ["銀行", "岸", ...]

                if (Array.isArray(terms)) {
                    terms.forEach(termRaw => {
                        const term = termRaw.trim();
                        if (!seenTranslations.has(term)) {
                            seenTranslations.add(term);
                            entries.push({
                                definition: '',
                                translation: term,
                                example: '',
                                examples: [],
                                pos: pos
                            });
                        } else if (term === primaryTranslation) {
                            // 若主翻譯剛好在詳解中出現，更新其真實的詞性
                            const primaryEntry = entries.find(e => e.translation === primaryTranslation);
                            if (primaryEntry && primaryEntry.pos === 'unknown') {
                                primaryEntry.pos = pos;
                            }
                        }
                    });
                }
            });
        }

        return {
            word,
            pos: entries.length > 0 ? entries[0].pos : 'unknown',
            phonetic,
            definition: '',
            translation: primaryTranslation,
            example: '',
            entries: entries,
            audioUrl: '',
            usAudioUrl: '',
            ukAudioUrl: '',
            source: 'Google Translate'
        };

    } catch (error) {
        console.warn("Google Translate API failed", error);
        return null;
    }
};
