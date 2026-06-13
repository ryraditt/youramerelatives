import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';

const parser = new Parser();

// Helper to decode Google News RSS links using the batchexecute endpoint
async function resolveGoogleNewsUrl(googleRssUrl: string): Promise<string> {
  try {
    const response = await fetch(googleRssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(4000) // 4-second timeout for link resolution
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const data = $('c-wiz[data-p]').attr('data-p');
    if (!data) return googleRssUrl; // Fallback
    
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
      body: new URLSearchParams(payload).toString(),
      signal: AbortSignal.timeout(4000)
    });
    
    const resText = await postResponse.text();
    const cleanJson = resText.replace(")]}'\n", "");
    const outerArray = JSON.parse(cleanJson);
    const innerData = outerArray[0][2];
    const articleData = JSON.parse(innerData);
    return articleData[1] || googleRssUrl;
  } catch (err) {
    console.error('Error resolving Google News URL:', err);
    return googleRssUrl;
  }
}

// Helper to scrape text from a direct article URL
async function scrapeArticleContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: AbortSignal.timeout(6000) // 6-second timeout per article fetch
    });
    
    if (!res.ok) return '';
    
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Remove unwanted page elements
    $('script, style, iframe, nav, header, footer, noscript, svg, form, ads, sidebar, .advertisement, .related-posts').remove();
    
    const paragraphs: string[] = [];
    $('p').each((_, element) => {
      const text = $(element).text().trim();
      // Only keep paragraphs that have substantial content (greater than 15 words)
      if (text.split(/\s+/).length > 15) {
        paragraphs.push(text);
      }
    });
    
    return paragraphs.join('\n\n');
  } catch (err) {
    console.error(`Error scraping content from ${url}:`, err);
    return '';
  }
}

// Helper to generate content with fallback models to avoid rate limits
async function generateContentWithFallback(
  ai: any,
  config: {
    contents: any[];
    config?: any;
  }
) {
  const models = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite'
  ];

  let lastError: any = null;
  for (const model of models) {
    try {
      console.log(`Attempting generation with model: ${model}...`);
      const response = await ai.models.generateContent({
        model,
        ...config
      });
      console.log(`Successfully generated content using model: ${model}`);
      return response;
    } catch (err: any) {
      console.warn(`Model ${model} failed:`, err.message || err);
      lastError = err;
    }
  }

  throw new Error(`All AI fallback models failed. Last error: ${lastError?.message || lastError}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action = 'synthesize', // 'search' or 'synthesize'
      commodity,
      style = 'general',
      tone = 'neutral',
      focus = 'financial',
      audience = 'public',
      customInstructions = '',
      articles = [] // Selected articles for synthesis
    } = body;

    if (!commodity) {
      return NextResponse.json({ error: 'Commodity is required' }, { status: 400 });
    }

    // ----------------------------------------------------
    // ACTION: SEARCH ARTICLES
    // ----------------------------------------------------
    if (action === 'search') {
      console.log(`Searching news for commodity: ${commodity}...`);
      
      const apiKey = process.env.GEMINI_API_KEY;
      
      // Default query strings
      let query1 = `"${commodity}" (mining OR metal OR extraction OR deposit OR pricing)`;
      let query2 = `"${commodity}" (production OR exploration OR reserves OR operations)`;

      // Agentic Search Planner: refine queries if Gemini API is configured
      if (apiKey && apiKey !== 'your_gemini_api_key_here') {
        console.log('Search Planner Agent active: refining Google News query strings...');
        try {
          const ai = new GoogleGenAI({ apiKey });
          
          const queryPrompt = `You are a search query optimizer for a mining news aggregator called "Your AME Relatives".
Given the following user criteria, generate exactly 2 distinct search query strings for a Google News RSS search.
- Commodity: ${commodity}
- Key Focus Area: ${focus}
- Analytical Tone: ${tone}
- Target Audience: ${audience}
- Custom Instructions: ${customInstructions || 'None'}

Each query should be a simple Google search query using keywords and operators (such as quotes for phrases or OR for synonyms). DO NOT include site restrictions (site:...) or time restrictions (when:7d). Do not use boolean operators like AND or NOT, just simple space-separated keywords and quotes where appropriate.
Keep queries concise and targeted (maximum 5-6 words per query).

Return your response as a valid JSON array of strings containing exactly 2 items.
Example response: ["lithium battery recycling permit", "lithium inflation extraction cost"]
Output ONLY the JSON array without markdown or explanation.`;

          const queryResponse = await generateContentWithFallback(ai, {
            contents: [{ role: 'user', parts: [{ text: queryPrompt }] }],
            config: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          });

          const rawText = (queryResponse.text || '[]').trim();
          console.log('Search Planner Agent response text:', rawText);
          const parsedQueries = JSON.parse(rawText);
          
          if (Array.isArray(parsedQueries) && parsedQueries.length >= 2) {
            query1 = parsedQueries[0];
            query2 = parsedQueries[1];
            console.log(`Search Planner Agent formulated queries: "${query1}" and "${query2}"`);
          }
        } catch (e) {
          console.error('Error running Search Planner Agent, falling back to default queries:', e);
        }
      }

      // 40+ Websites split into 4 logical groups to respect query size limits
      const groups = [
        'site:reuters.com OR site:mining.com OR site:miningweekly.com OR site:bloomberg.com OR site:mining-technology.com OR site:ft.com OR site:wsj.com OR site:cnbc.com OR site:spglobal.com OR site:finance.yahoo.com',
        'site:marketwatch.com OR site:seekingalpha.com OR site:investing.com OR site:kitco.com OR site:miningmagazine.com OR site:im-mining.com OR site:miningglobal.com OR site:engineeringnews.co.za OR site:forbes.com OR site:northernminer.com',
        'site:nsenergybusiness.com OR site:smallcaps.com.au OR site:cruxinvestor.com OR site:fastmarkets.com OR site:argusmedia.com OR site:metalbulletin.com OR site:steelorbis.com OR site:recyclingtoday.com OR site:e-mj.com OR site:magazine.cim.org',
        'site:australianmining.com.au OR site:miningreview.com OR site:resourceworld.com OR site:gold-eagle.com OR site:silverinstitute.org OR site:miningnews.net OR site:creamermedia.co.za OR site:bnnbloomberg.ca OR site:visualcapitalist.com OR site:metalsdaily.com'
      ];

      const allItems: any[] = [];
      const seenLinks = new Set<string>();

      // Fetch groups in parallel
      const feeds = await Promise.all(
        groups.map(async (group, index) => {
          try {
            const activeQuery = index < 2 ? query1 : query2;
            const fullQuery = `(${activeQuery}) (${group}) when:7d`;
            const url = `https://news.google.com/rss/search?q=${encodeURIComponent(fullQuery)}&hl=en-US&gl=US&ceid=US:en`;
            return await parser.parseURL(url);
          } catch (err) {
            console.error(`Error fetching group feed ${index}:`, err);
            return { items: [] };
          }
        })
      );

      for (const feed of feeds) {
        if (feed && feed.items) {
          for (const item of feed.items) {
            if (item.link && !seenLinks.has(item.link)) {
              seenLinks.add(item.link);
              allItems.push(item);
            }
          }
        }
      }

      // Fallback 1: Broad query if few items from curated list
      if (allItems.length < 6) {
        console.log('Fewer than 6 articles. Running broader fallback search...');
        try {
          const query = `"${commodity}" (mining OR metal OR extraction OR deposit OR pricing) when:7d`;
          const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
          const broadFeed = await parser.parseURL(url);
          if (broadFeed && broadFeed.items) {
            for (const item of broadFeed.items) {
              if (item.link && !seenLinks.has(item.link)) {
                seenLinks.add(item.link);
                allItems.push(item);
              }
            }
          }
        } catch (err) {
          console.error('Error in broad fallback search:', err);
        }
      }

      // Fallback 2: Remove time constraint if still empty
      if (allItems.length === 0) {
        console.log('No articles found. Running unlimited fallback search...');
        try {
          const query = `"${commodity}" (mining OR metal OR extraction OR deposit)`;
          const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
          const unlimitedFeed = await parser.parseURL(url);
          if (unlimitedFeed && unlimitedFeed.items) {
            for (const item of unlimitedFeed.items) {
              if (item.link && !seenLinks.has(item.link)) {
                seenLinks.add(item.link);
                allItems.push(item);
              }
            }
          }
        } catch (err) {
          console.error('Error in unlimited fallback search:', err);
        }
      }

      // Sort by date (newest first)
      allItems.sort((a, b) => {
        const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return dateB - dateA;
      });

      // Extract up to 25 items for the user checklist
      const itemsToResolve = allItems.slice(0, 25);
      
      // Resolve Google redirect URLs in parallel
      const decodedArticles = await Promise.all(
        itemsToResolve.map(async (item) => {
          const resolvedUrl = await resolveGoogleNewsUrl(item.link);
          const cleanSource = item.source?.title || new URL(resolvedUrl).hostname.replace('www.', '');
          return {
            title: item.title,
            originalUrl: resolvedUrl,
            pubDate: item.pubDate || new Date().toISOString(),
            sourceName: cleanSource,
            snippet: item.contentSnippet || item.content || ''
          };
        })
      );

      return NextResponse.json({ articles: decodedArticles });
    }

    // ----------------------------------------------------
    // ACTION: SYNTHESIZE & PARAPHRASE REPORT
    // ----------------------------------------------------
    if (action === 'synthesize') {
      console.log(`Synthesizing report from ${articles.length} selected articles...`);
      
      if (!articles || articles.length === 0) {
        return NextResponse.json({ error: 'At least one article must be selected for synthesis.' }, { status: 400 });
      }

      // Setup Gemini API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        return NextResponse.json({
          error: 'API Key is missing or not configured. Please add your key to .env.local to generate the report.'
        }, { status: 401 });
      }

      const ai = new GoogleGenAI({ apiKey });

      // Intelligent Selector Agent: filter articles based on title & snippets
      let selectedArticles = articles;
      const autoSelect = body.autoSelect || false;

      if (autoSelect && articles.length > 5) {
        console.log('Auto-select mode active: running Gemini selection agent...');
        try {
          const selectionPrompt = `You are an AI research assistant for the mining news aggregator "Your AME Relatives".
Your task is to analyze these ${articles.length} news article titles and snippets and select the 3 to 5 most relevant, high-quality, and non-duplicate articles focusing on the commodity "${commodity}".

List of articles:
${articles.map((art: any, idx: number) => `Index: ${idx}
Title: ${art.title}
Source: ${art.sourceName}
Snippet: ${art.snippet}`).join('\n\n')}

Return ONLY a valid JSON array containing the indices of the selected articles (between 3 and 5 items). Do not output markdown, thoughts, or extra characters. Example response format: [0, 2, 5]`;

          const selectionResponse = await generateContentWithFallback(ai, {
            contents: [{ role: 'user', parts: [{ text: selectionPrompt }] }],
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          });

          const rawJson = (selectionResponse.text || '[]').trim();
          console.log('Gemini selector agent output:', rawJson);
          const chosenIndices = JSON.parse(rawJson);
          
          if (Array.isArray(chosenIndices) && chosenIndices.length > 0) {
            selectedArticles = chosenIndices
              .map((idx: number) => articles[idx])
              .filter((art: any) => art !== undefined);
            console.log(`Gemini selector agent selected: ${selectedArticles.map((a: any) => a.title).join(', ')}`);
          }
        } catch (selectErr) {
          console.error('Error in Gemini selector agent, falling back to top 5 articles:', selectErr);
          selectedArticles = articles.slice(0, 5);
        }
      }

      // Scrape in parallel
      const processedArticles = await Promise.all(
        selectedArticles.slice(0, 8).map(async (art: any) => {
          console.log(`Scraping content for: ${art.title}`);
          const content = await scrapeArticleContent(art.originalUrl);
          
          return {
            title: art.title,
            originalUrl: art.originalUrl,
            pubDate: art.pubDate,
            sourceName: art.sourceName,
            content: content && content.length > 200 ? content : art.snippet // Fallback to feed snippet if scrape fails
          };
        })
      );

      const validArticles = processedArticles.filter(art => art.content && art.content.length > 15);

      if (validArticles.length === 0) {
        return NextResponse.json({ error: 'Failed to extract usable text content from selected articles.' }, { status: 400 });
      }

      // Parameter dictionaries
      const styleDescriptions: Record<string, string> = {
        general: 'General Journalism (Reuters/Bloomberg style) - Objective, professional, third-person perspective, inverted pyramid structure.',
        corporate: 'Corporate / Investor Relations - Focus on market capitalization, mergers and acquisitions, stock impacts, quarterly earnings, and financial outlook.',
        technical: 'Technical / Geological Analyst - Focus on extraction grades, engineering details, exploration statistics, processing technology, and operational metrics.',
        executive: 'Executive Brief - Highly concise, clear bold headings, bullet points, focused on key decisions and high-level macro impacts.',
        esg: 'ESG & Sustainability - Focus on environmental impact, regulatory compliances, safety track records, carbon emissions, and local community/geopolitical relations.'
      };

      const toneDescriptions: Record<string, string> = {
        neutral: 'Objective and balanced. Present multiple perspectives without taking a strong side.',
        bullish: 'Optimistic and encouraging. Highlight growth opportunities, price increases, and positive operational expansions.',
        bearish: 'Cautious and skeptical. Highlight downside risks, operational delays, cost increases, and regulatory challenges.'
      };

      const targetAudienceDescriptions: Record<string, string> = {
        directors: 'Board of Directors & Executives - Focus on strategic, financial, and risk-management decisions.',
        investors: 'Retail & Institutional Investors - Focus on financial returns, commodity prices, and asset valuations.',
        public: 'General Public & Community - Clear, accessible language focusing on local impact, safety, and ESG.',
        managers: 'Operations Managers & Engineers - Focus on operational details, supply chain, and production logistics.'
      };

      const focusAreaDescriptions: Record<string, string> = {
        geopolitical: 'Geopolitical & Regulatory - Highlight trade tensions, permits, government changes, and local laws.',
        financial: 'Financial Markets - Highlight commodity price action, company stocks, interest rates, and inflation.',
        supply_chain: 'Supply Chain & Operations - Highlight shipping, labor, raw material shortages, and equipment.',
        green_transition: 'Green Transition - Highlight electrification, EV batteries, recycling, and carbon reduction.'
      };

      // Compile content for LLM
      const sourcesContext = validArticles.map((art, idx) => {
        return `--- SOURCE ARTICLE ${idx + 1} ---
Title: ${art.title}
Source: ${art.sourceName}
URL: ${art.originalUrl}
Content:
${art.content}
`;
      }).join('\n\n');

      const systemPrompt = `You are an elite, Pulitzer-caliber senior journalist and lead editor specializing in the global mining, metals, and energy markets. 
Your objective is to produce a highly professional, analytical, and seamless news synthesis based on the provided source materials. 

You must meet the highest editorial standards of publications like the Financial Times, Bloomberg, and Reuters:
1. **Classic News Lede Structure:** Start the report with a powerful, active lede (lead paragraph). Do not use generic introductions or pleasantries. Begin immediately with the most critical news development, quoting specific values, locations, and actions (e.g. "A sudden tightening of environmental regulations in Ontario has threatened to stall major gold projects...").
2. **True Synthesized Narrative:** Do not write disjointed summaries of individual articles. Merge overlapping facts, stats, and quotes from all sources into a single, beautifully structured storyline. If multiple sources mention a mining project, fuse their data points together organically.
3. **Masterful Journalistic Sourcing & Attribution:** Embed native, flowing journalistic attributions within the text rather than parenthetical tags (e.g. use *"According to data compiled by Fastmarkets..."*, *"Analysts speaking to Bloomberg indicated..."*, *"An operational update from Mining Weekly outlines..."*). Use active verbs for attribution: "indicates", "argues", "reports", "warns", "discloses".
4. **Strict Ban on AI Filler & Clichés:** Under no circumstances use common AI filler words or phrases. You are strictly prohibited from using: "testament", "delve", "tapestry", "in conclusion", "moreover", "crucial role", "beacon of hope", "notably", "significantly", "journey", "landscape". Write with crisp, sharp, active verbs and concrete, data-dense nouns.
5. **Contextual Implication Analysis:** Beyond listing events, explain the 'why' behind the news. Relate operational actions (like shutdowns, strikes, or expansions) to broader macro elements (inflation, supply deficits, geopolitical tensions, policy shifts).

Apply the following configurations with extreme fidelity:
- Commodity Focus: ${commodity.toUpperCase()}
- Writing Style: ${styleDescriptions[style] || style}
- Tone: ${toneDescriptions[tone] || tone}
- Target Audience: ${targetAudienceDescriptions[audience] || audience}
- Key Focus: ${focusAreaDescriptions[focus] || focus}
${customInstructions ? `- Special User Requests: ${customInstructions}` : ''}

Strict Paraphrasing & Truthfulness:
- Fully paraphrase all sentences. Never copy verbatim phrases from the source texts.
- Do not invent, speculate, or extrapolate facts, numbers, dates, or company actions. If a metric is not present in the sources, do not mention it.

Fact Verification & Auditing (Auditor Agent Mode):
- Actively cross-reference all numbers, statistics, price actions, and dates across the source articles.
- Look for direct contradictions (e.g., source A claiming output rose 3% while source B claiming a 2% decline, or conflicting project completion timelines).
- If you find any factual conflicts or contradictions, resolve them objectively using local context (e.g. clarify that one is mine-specific while the other is country-wide, or that one is a later projection) and document the findings in a dedicated section titled "## Multi-Source Fact Audit & Discrepancies" at the end of the report (just before the References).
- If there are no discrepancies or contradictions, do not output this section.

Required News Structure:
1. **Compelling Headline**: Create a professional, catchy headline suitable for the selected style.
2. **Executive Summary / Lead Paragraph**: A bolded, high-level overview of the most critical developments (1 paragraph).
3. **Key Takeaways**: A bulleted list of 3-4 vital points.
4. **Body Paragraphs**: 3-5 well-structured paragraphs going deeper into the market dynamics, operational changes, and geological/financial data.
5. **Future Outlook**: A brief section outlining what to watch next (1 paragraph).
6. **Multi-Source Fact Audit & Discrepancies**: (Only if discrepancies were found, as instructed above).
7. **Sources & References**: List the sources used, displaying their name as a clickable link pointing to their original URL. Use format: "[Source Name](URL)" - Pub Date.
`;

      console.log('Sending request to Gemini...');
      const response = await generateContentWithFallback(ai, {
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\n' + sourcesContext }] }
        ],
        config: {
          temperature: 0.3
        }
      });

      const synthesizedArticle = response.text;
      console.log('Successfully received response from Gemini.');

      return NextResponse.json({
        synthesizedArticle,
        sources: validArticles.map(art => ({
          title: art.title,
          url: art.originalUrl,
          pubDate: art.pubDate,
          sourceName: art.sourceName
        }))
      });
    }

    return NextResponse.json({ error: 'Invalid API Action' }, { status: 400 });

  } catch (err: any) {
    console.error('Error generating news:', err);
    return NextResponse.json({
      error: 'An internal error occurred while processing the news report.',
      details: err.message
    }, { status: 500 });
  }
}
