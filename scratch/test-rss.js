const Parser = require('rss-parser');
const cheerio = require('cheerio');

const parser = new Parser();

async function getArticleUrl(googleRssUrl) {
  try {
    const response = await fetch(googleRssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const data = $('c-wiz[data-p]').attr('data-p');
    if (!data) return googleRssUrl;
    
    const obj = JSON.parse(data.replace('%.@.', '["garturlreq",'));
    const payloadData = [[
      'Fbv4je',
      JSON.stringify([...obj.slice(0, -6), ...obj.slice(-2)]),
      null,
      'generic'
    ]];
    const payload = {
      'f.req': JSON.stringify([payloadData])
    };
    
    const postResponse = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: new URLSearchParams(payload).toString()
    });
    
    const resText = await postResponse.text();
    const cleanJson = resText.replace(")]}'\n", "");
    const outerArray = JSON.parse(cleanJson);
    const innerData = outerArray[0][2];
    const articleData = JSON.parse(innerData);
    return articleData[1];
  } catch (err) {
    return googleRssUrl;
  }
}

async function scrapeArticle(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    console.log(`- GET ${url.substring(0, 50)}... Status: ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Remove scripts, styles, navs, headers, footers
    $('script, style, iframe, nav, header, footer, noscript').remove();
    
    const paragraphs = [];
    $('p').each((index, element) => {
      const text = $(element).text().trim();
      // Only keep paragraphs that have a reasonable word count
      if (text.split(/\s+/).length > 15) {
        paragraphs.push(text);
      }
    });
    
    return paragraphs;
  } catch (err) {
    console.log(`- Failed to fetch ${url.substring(0, 50)}... Error: ${err.message}`);
    return [];
  }
}

async function test() {
  const query = 'copper mining';
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  
  try {
    const feed = await parser.parseURL(rssUrl);
    console.log(`Found ${feed.items.length} items. Testing first 3...`);
    
    for (let i = 0; i < Math.min(feed.items.length, 3); i++) {
      const item = feed.items[i];
      console.log(`\nItem ${i + 1}: ${item.title}`);
      const targetUrl = await getArticleUrl(item.link);
      console.log(`  Resolved URL: ${targetUrl}`);
      const paragraphs = await scrapeArticle(targetUrl);
      console.log(`  Paragraphs extracted: ${paragraphs.length}`);
      if (paragraphs.length > 0) {
        console.log(`  Snippet: ${paragraphs[0].substring(0, 150)}...`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
