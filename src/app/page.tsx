'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Hammer, 
  Coins, 
  Flame, 
  Shield, 
  TrendingUp, 
  Leaf, 
  FileText, 
  Download, 
  Copy, 
  RefreshCw, 
  ArrowLeft, 
  Globe, 
  Users, 
  Sparkles,
  Check,
  AlertTriangle,
  ExternalLink,
  Search,
  BookOpen,
  ListChecks,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import styles from './page.module.css';

interface SearchedArticle {
  title: string;
  originalUrl: string;
  pubDate: string;
  sourceName: string;
  snippet: string;
}

interface Source {
  title: string;
  url: string;
  pubDate: string;
  sourceName: string;
}

// Custom Markdown to React Parser
const MarkdownRenderer: React.FC<{ markdown: string }> = ({ markdown }) => {
  if (!markdown) return null;

  const blocks = markdown.split(/\n\n+/);

  const parseInlineMarkdown = (text: string) => {
    // Process bold text: **text**
    let processed = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Process italic text: *text*
    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Process markdown links: [text](url)
    processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return processed;
  };

  return (
    <div className="markdown-content">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Header 1
        if (trimmed.startsWith('# ')) {
          return (
            <h1 
              key={index} 
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(trimmed.replace('# ', '')) }} 
            />
          );
        }
        
        // Header 2
        if (trimmed.startsWith('## ')) {
          return (
            <h2 
              key={index} 
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(trimmed.replace('## ', '')) }} 
            />
          );
        }

        // Header 3
        if (trimmed.startsWith('### ')) {
          return (
            <h3 
              key={index} 
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(trimmed.replace('### ', '')) }} 
            />
          );
        }

        // Blockquote
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote 
              key={index} 
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(trimmed.replace('> ', '')) }} 
            />
          );
        }

        // Unordered List (- or *)
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const items = trimmed.split('\n');
          return (
            <ul key={index}>
              {items.map((item, subIdx) => (
                <li 
                  key={subIdx} 
                  dangerouslySetInnerHTML={{ 
                    __html: parseInlineMarkdown(item.replace(/^[-*]\s+/, '')) 
                  }} 
                />
              ))}
            </ul>
          );
        }

        // Ordered List (1. 2. etc)
        if (/^\d+\.\s+/.test(trimmed)) {
          const items = trimmed.split('\n');
          return (
            <ol key={index}>
              {items.map((item, subIdx) => (
                <li 
                  key={subIdx} 
                  dangerouslySetInnerHTML={{ 
                    __html: parseInlineMarkdown(item.replace(/^\d+\.\s+/, '')) 
                  }} 
                />
              ))}
            </ol>
          );
        }

        // Standard Paragraph
        return (
          <p 
            key={index} 
            dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(trimmed) }} 
          />
        );
      })}
    </div>
  );
};

export default function Home() {
  // Form States
  const [commodity, setCommodity] = useState('gold');
  const [customCommodity, setCustomCommodity] = useState('');
  const [writingStyle, setWritingStyle] = useState('general');
  const [customWritingStyle, setCustomWritingStyle] = useState('');
  const [tone, setTone] = useState('neutral');
  const [customTone, setCustomTone] = useState('');
  const [focusArea, setFocusArea] = useState('financial');
  const [customFocusArea, setCustomFocusArea] = useState('');
  const [targetAudience, setTargetAudience] = useState('public');
  const [customTargetAudience, setCustomTargetAudience] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  // Step wizard states
  const [status, setStatus] = useState<'idle' | 'searching' | 'selection' | 'loading' | 'success' | 'error'>('idle');
  const [errorPhase, setErrorPhase] = useState<'search' | 'synthesize'>('search');
  
  // Articles search results
  const [articlesList, setArticlesList] = useState<SearchedArticle[]>([]);
  const [selectedArticleUrls, setSelectedArticleUrls] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState<'auto' | 'manual'>('auto');
  const [expandedArticleIdx, setExpandedArticleIdx] = useState<number | null>(null);

  // Progressive Synthesis states
  const [loadingStep, setLoadingStep] = useState(1);
  const [progressWidth, setProgressWidth] = useState(0);
  const [synthesizedArticle, setSynthesizedArticle] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadingInterval = useRef<NodeJS.Timeout | null>(null);

  // Progressive Loading checklist configuration
  const steps = [
    { id: 1, text: 'Initializing synthesis and reading selected articles...', maxProgress: 20 },
    { id: 2, text: 'Scraping full-text paragraphs and caching snippets...', maxProgress: 50 },
    { id: 3, text: 'Executing Advanced AI content generator and paraphrasing...', maxProgress: 85 },
    { id: 4, text: 'Finalizing report tone, style attributes, and references...', maxProgress: 95 },
    { id: 5, text: 'Done! Compiling document for Your AME Relatives...', maxProgress: 100 }
  ];

  // Clean interval on unmount
  useEffect(() => {
    return () => {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    };
  }, []);

  // Categorize errors and supply actionable resolutions
  const getErrorDiagnostics = (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes('api key') || lower.includes('key is missing') || lower.includes('key not configured')) {
      return {
        title: 'API Key Configuration Issue',
        suggestion: 'The AI model requires a valid API key to run. Please verify that your .env.local file exists in the project root and includes GEMINI_API_KEY=your_key_here.'
      };
    }
    if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('429')) {
      return {
        title: 'Rate Limit / Quota Exceeded',
        suggestion: 'All fallback models in the chain were rate-limited or ran out of quota. Please wait 1-2 minutes for the quota window to reset, or check your API billing status.'
      };
    }
    if (lower.includes('extract usable text') || lower.includes('scraping') || lower.includes('paragraphs')) {
      return {
        title: 'Scraping Blocked or Empty Content',
        suggestion: 'The scraper was unable to extract readable paragraphs from the selected websites (they might be paywalled, require JavaScript, or block automated traffic). Go back and try selecting a different combination of articles.'
      };
    }
    if (lower.includes('could not find any recent') || lower.includes('rss') || lower.includes('network')) {
      return {
        title: 'Search Queries Returned No Results',
        suggestion: 'The AI Search Planner formulated queries that returned no news articles from the 40+ portals. Try choosing a broader commodity, shortening custom text inputs, or verifying your network connection.'
      };
    }
    return null;
  };

  // Handle Step 1: News Search & Discovery
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStatus('searching');
    setErrorMessage('');
    setErrorPhase('search');
    
    try {
      const activeCommodity = commodity === 'custom' ? customCommodity : commodity;
      
      const response = await fetch('/api/generate-news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'search',
          commodity: activeCommodity,
          style: writingStyle === 'custom' ? customWritingStyle : writingStyle,
          tone: tone === 'custom' ? customTone : tone,
          focus: focusArea === 'custom' ? customFocusArea : focusArea,
          audience: targetAudience === 'custom' ? customTargetAudience : targetAudience,
          customInstructions
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details ? `${data.error} (${data.details})` : (data.error || 'Failed to search news articles.'));
      }

      if (!data.articles || data.articles.length === 0) {
        throw new Error(`Could not find any recent mining news articles for "${activeCommodity}".`);
      }

      setArticlesList(data.articles);
      // Default: select all resolved articles
      setSelectedArticleUrls(data.articles.map((art: any) => art.originalUrl));
      setSelectionMode('auto');
      setStatus('selection');

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An unexpected error occurred while searching. Please try again.');
      setStatus('error');
    }
  };

  // Handle Step 2: Scrape & Synthesize Selected Articles
  const handleSynthesize = async () => {
    setStatus('loading');
    setErrorMessage('');
    setErrorPhase('synthesize');
    
    setLoadingStep(1);
    setProgressWidth(5);
    
    let currentStep = 1;
    let currentProgress = 5;
    
    if (loadingInterval.current) clearInterval(loadingInterval.current);
    
    loadingInterval.current = setInterval(() => {
      const activeStep = steps.find(s => s.id === currentStep);
      if (activeStep) {
        const increment = (activeStep.maxProgress - currentProgress) / 8;
        currentProgress = Math.min(activeStep.maxProgress, currentProgress + Math.max(0.5, increment));
        setProgressWidth(currentProgress);
        
        if (currentProgress >= activeStep.maxProgress && currentStep < 4) {
          currentStep += 1;
          setLoadingStep(currentStep);
        }
      }
    }, 400);

    try {
      const activeCommodity = commodity === 'custom' ? customCommodity : commodity;
      const activeStyle = writingStyle === 'custom' ? customWritingStyle : writingStyle;
      const activeTone = tone === 'custom' ? customTone : tone;
      const activeFocus = focusArea === 'custom' ? customFocusArea : focusArea;
      const activeAudience = targetAudience === 'custom' ? customTargetAudience : targetAudience;

      // Filter selected articles
      let articlesToSynthesize = [];
      if (selectionMode === 'auto') {
        // Feed all resolved articles so the Gemini Selector Agent can choose the best ones
        articlesToSynthesize = articlesList;
      } else {
        articlesToSynthesize = articlesList.filter(art => selectedArticleUrls.includes(art.originalUrl));
      }

      if (articlesToSynthesize.length === 0) {
        throw new Error('Please select at least one news article to paraphrase.');
      }

      const response = await fetch('/api/generate-news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'synthesize',
          commodity: activeCommodity,
          style: activeStyle,
          tone: activeTone,
          focus: activeFocus,
          audience: activeAudience,
          customInstructions,
          articles: articlesToSynthesize,
          autoSelect: selectionMode === 'auto'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details ? `${data.error} (${data.details})` : (data.error || 'Failed to generate paraphrased news report.'));
      }

      if (loadingInterval.current) clearInterval(loadingInterval.current);
      setLoadingStep(5);
      setProgressWidth(100);

      setTimeout(() => {
        setSynthesizedArticle(data.synthesizedArticle);
        setSources(data.sources || []);
        setStatus('success');
      }, 800);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
      setStatus('error');
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    }
  };

  // Toggle checkbox state for manual selection
  const handleCheckboxToggle = (url: string) => {
    if (selectedArticleUrls.includes(url)) {
      setSelectedArticleUrls(selectedArticleUrls.filter(u => u !== url));
    } else {
      setSelectedArticleUrls([...selectedArticleUrls, url]);
    }
  };

  // Select or Deselect all helper
  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedArticleUrls(articlesList.map(a => a.originalUrl));
    } else {
      setSelectedArticleUrls([]);
    }
  };

  // Action: Copy to clipboard
  const handleCopy = () => {
    if (!synthesizedArticle) return;
    navigator.clipboard.writeText(synthesizedArticle);
    showToast('Article copied to clipboard!');
  };

  // Action: Download MD file
  const handleDownload = () => {
    if (!synthesizedArticle) return;
    const element = document.createElement('a');
    const file = new Blob([synthesizedArticle], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    const dateStr = new Date().toISOString().split('T')[0];
    const activeCommodity = commodity === 'custom' ? customCommodity : commodity;
    element.download = `${activeCommodity.toLowerCase().replace(/\s+/g, '_')}_news_${dateStr}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('Download started!');
  };

  // Action: Print / Save to PDF
  const handlePrint = () => {
    window.print();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // Helper to get styled commodity icon
  const getCommodityIcon = (name: string) => {
    switch (name) {
      case 'gold':
      case 'silver':
        return <Coins className={styles.titleIcon} size={32} />;
      case 'coal':
        return <Flame className={styles.titleIcon} size={32} />;
      case 'copper':
      case 'nickel':
      case 'lithium':
      case 'iron ore':
      default:
        return <Hammer className={styles.titleIcon} size={32} />;
    }
  };

  const activeCommodityName = commodity === 'custom' ? customCommodity : commodity;

  return (
    <div className={styles.wrapper}>
      {/* Toast Notification */}
      <div className={`${styles.toast} ${toastMessage ? styles.toastShow : ''}`}>
        <Check size={18} />
        <span>{toastMessage}</span>
      </div>

      {/* Header section */}
      <header className={styles.header}>
        <div className={styles.titleContainer}>
          {getCommodityIcon(commodity)}
          <h1 className={styles.title}>Your AME Relatives</h1>
        </div>
        <p className={styles.subtitle}>
          Search and aggregate mining news across 40+ premium industry portals, review source references, and synthesize bespoke paraphrased updates using Advanced AI.
        </p>
      </header>

      {/* Main container */}
      <main className={styles.mainContent}>
        <div className={`container ${styles.cardContainer}`}>
          
          {/* STEP 1: Configuration & Search Form */}
          {status === 'idle' && (
            <div className="glass-panel animate-fade-in">
              <div className={styles.formHeader}>
                <Sparkles size={20} className="text-glow" style={{ color: 'var(--primary-gold)' }} />
                <h2 className={styles.formHeaderTitle}>Configure Report Parameters</h2>
              </div>
              <form onSubmit={handleSearch}>
                <div className={styles.formBody}>
                  <div className={styles.formGrid}>
                    
                    {/* Input: Commodity */}
                    <div className={styles.formGroup}>
                      <label htmlFor="commodity" className={styles.label}>
                        Select Mining Commodity
                      </label>
                      <select 
                        id="commodity"
                        className={styles.select}
                        value={commodity}
                        onChange={(e) => setCommodity(e.target.value)}
                      >
                        <option value="gold">Gold (Au)</option>
                        <option value="copper">Copper (Cu)</option>
                        <option value="nickel">Nickel (Ni)</option>
                        <option value="lithium">Lithium (Li)</option>
                        <option value="coal">Thermal / Metallurgical Coal</option>
                        <option value="iron ore">Iron Ore (Fe)</option>
                        <option value="cobalt">Cobalt (Co)</option>
                        <option value="silver">Silver (Ag)</option>
                        <option value="zinc">Zinc (Zn)</option>
                        <option value="custom">Other / Custom...</option>
                      </select>
                      {commodity === 'custom' && (
                        <input 
                          type="text"
                          className={styles.input}
                          style={{ marginTop: '0.5rem' }}
                          placeholder="Type custom commodity, e.g., Uranium"
                          value={customCommodity}
                          onChange={(e) => setCustomCommodity(e.target.value)}
                          required
                        />
                      )}
                    </div>

                    {/* Input: Writing Style */}
                    <div className={styles.formGroup}>
                      <label htmlFor="style" className={styles.label}>
                        Writing Style Preference
                      </label>
                      <select 
                        id="style"
                        className={styles.select}
                        value={writingStyle}
                        onChange={(e) => setWritingStyle(e.target.value)}
                      >
                        <option value="general">General Journalism (Balanced Reuters-Style)</option>
                        <option value="corporate">Investor Relations (Financial / Stock Focus)</option>
                        <option value="technical">Technical / Geological (Operational metrics)</option>
                        <option value="executive">Executive Brief (High-level Bullet Points)</option>
                        <option value="esg">ESG & Sustainability (Environmental Focus)</option>
                        <option value="custom">Other / Custom...</option>
                      </select>
                      {writingStyle === 'custom' && (
                        <input 
                          type="text"
                          className={styles.input}
                          style={{ marginTop: '0.5rem' }}
                          placeholder="Type custom writing style, e.g., Academic"
                          value={customWritingStyle}
                          onChange={(e) => setCustomWritingStyle(e.target.value)}
                          required
                        />
                      )}
                    </div>

                    {/* Input: Tone */}
                    <div className={styles.formGroup}>
                      <label htmlFor="tone" className={styles.label}>
                        Analytical Tone
                      </label>
                      <select 
                        id="tone"
                        className={styles.select}
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                      >
                        <option value="neutral">Neutral & Objective (Standard Report)</option>
                        <option value="bullish">Bullish (Highlight positive expansions/price growth)</option>
                        <option value="bearish">Bearish (Highlight risks/delays/inflation)</option>
                        <option value="custom">Other / Custom...</option>
                      </select>
                      {tone === 'custom' && (
                        <input 
                          type="text"
                          className={styles.input}
                          style={{ marginTop: '0.5rem' }}
                          placeholder="Type custom tone, e.g., Satirical"
                          value={customTone}
                          onChange={(e) => setCustomTone(e.target.value)}
                          required
                        />
                      )}
                    </div>

                    {/* Input: Focus Area */}
                    <div className={styles.formGroup}>
                      <label htmlFor="focus" className={styles.label}>
                        Key Focus Area
                      </label>
                      <select 
                        id="focus"
                        className={styles.select}
                        value={focusArea}
                        onChange={(e) => setFocusArea(e.target.value)}
                      >
                        <option value="financial">Financial Markets & Pricing</option>
                        <option value="geopolitical">Geopolitical Permitting & Regulation</option>
                        <option value="supply_chain">Supply Chain & Operations</option>
                        <option value="green_transition">Green Transition & Decarbonization</option>
                        <option value="custom">Other / Custom...</option>
                      </select>
                      {focusArea === 'custom' && (
                        <input 
                          type="text"
                          className={styles.input}
                          style={{ marginTop: '0.5rem' }}
                          placeholder="Type custom focus, e.g., Tech & Innovation"
                          value={customFocusArea}
                          onChange={(e) => setCustomFocusArea(e.target.value)}
                          required
                        />
                      )}
                    </div>

                    {/* Input: Target Audience */}
                    <div className={styles.formGroup}>
                      <label htmlFor="audience" className={styles.label}>
                        Target Audience
                      </label>
                      <select 
                        id="audience"
                        className={styles.select}
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                      >
                        <option value="public">General Public & Customers</option>
                        <option value="directors">Board of Directors & Executives</option>
                        <option value="investors">Investors & Shareholders</option>
                        <option value="managers">Mine Managers & Engineers</option>
                        <option value="custom">Other / Custom...</option>
                      </select>
                      {targetAudience === 'custom' && (
                        <input 
                          type="text"
                          className={styles.input}
                          style={{ marginTop: '0.5rem' }}
                          placeholder="Type custom audience, e.g., Regulators"
                          value={customTargetAudience}
                          onChange={(e) => setCustomTargetAudience(e.target.value)}
                          required
                        />
                      )}
                    </div>

                    {/* Branding Tip */}
                    <div className={styles.formGroup} style={{ justifyContent: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Info size={16} style={{ color: 'var(--primary-gold)', flexShrink: 0 }} />
                        <span>Aggregates from premium networks including Reuters, Mining.com, CNBC, FT, and S&P Global.</span>
                      </p>
                    </div>

                    {/* Input: Custom Instructions */}
                    <div className={styles.formGroupFull}>
                      <label htmlFor="instructions" className={styles.label}>
                        Additional Custom Instructions (Optional)
                      </label>
                      <textarea
                        id="instructions"
                        className={styles.textarea}
                        placeholder="E.g., Focus on Australian operations, compare output rates with last year, mention the impact of inflation on operational costs, etc..."
                        value={customInstructions}
                        onChange={(e) => setCustomInstructions(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.formFooter}>
                  <button 
                    type="submit" 
                    className="btn-primary"
                  >
                    <Search size={18} />
                    Search News Articles
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2: Searching Articles (Fast Loader) */}
          {status === 'searching' && (
            <div className="glass-panel animate-fade-in" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 1.5rem' }}></div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Searching 40+ News Sites
              </h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Scanning RSS indices, removing duplicates, and resolving redirected article URLs for <strong style={{ color: 'var(--primary-gold)' }}>{activeCommodityName}</strong>.
              </p>
            </div>
          )}

          {/* STEP 3: Article Selection Panel */}
          {status === 'selection' && (
            <div className="glass-panel animate-fade-in">
              <div className={styles.formHeader} style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <ListChecks size={22} style={{ color: 'var(--primary-gold)' }} />
                  <div>
                    <h2 className={styles.formHeaderTitle}>Select Articles to Paraphrase</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Discovered {articlesList.length} articles matching your search query.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.03)', padding: '0.25rem', borderRadius: '4px' }}>
                  <button
                    type="button"
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      background: selectionMode === 'auto' ? 'var(--primary-gold)' : 'transparent',
                      color: selectionMode === 'auto' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                    onClick={() => {
                      setSelectionMode('auto');
                      setSelectedArticleUrls(articlesList.map(a => a.originalUrl));
                    }}
                  >
                    🤖 Let AI Choose
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      background: selectionMode === 'manual' ? 'var(--primary-gold)' : 'transparent',
                      color: selectionMode === 'manual' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                    onClick={() => setSelectionMode('manual')}
                  >
                    ✏️ Manual Select
                  </button>
                </div>
              </div>

              <div className={styles.formBody}>
                {selectionMode === 'auto' ? (
                  <div style={{
                    background: 'rgba(234, 88, 12, 0.04)',
                    border: '1px solid rgba(234, 88, 12, 0.15)',
                    padding: '1rem',
                    borderRadius: 'var(--border-radius-sm)',
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <Sparkles size={20} style={{ color: 'var(--primary-gold)', flexShrink: 0 }} />
                    <span>
                      <strong>Let AI Choose mode active:</strong> The AI Agent will analyze the search feed and automatically select, extract, and combine facts from the most relevant articles.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Selected <strong style={{ color: 'var(--primary-gold)' }}>{selectedArticleUrls.length}</strong> of {articlesList.length} articles (Recommended: 1 to 5 articles)
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => handleSelectAll(true)}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => handleSelectAll(false)}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                )}

                {/* Article checklist container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {articlesList.map((art, idx) => {
                    const isChecked = selectedArticleUrls.includes(art.originalUrl);
                    const isExpanded = expandedArticleIdx === idx;
                    
                    return (
                      <div 
                        key={idx} 
                        style={{
                          background: isChecked ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.5)',
                          border: isChecked ? '1px solid rgba(234, 88, 12, 0.25)' : '1px solid rgba(0, 0, 0, 0.08)',
                          borderRadius: 'var(--border-radius-sm)',
                          padding: '1rem',
                          transition: 'all 0.2s ease',
                          opacity: selectionMode === 'auto' ? 0.95 : 1
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                          <input 
                            type="checkbox"
                            style={{
                              marginTop: '0.25rem',
                              width: '18px',
                              height: '18px',
                              cursor: selectionMode === 'auto' ? 'not-allowed' : 'pointer',
                              accentColor: 'var(--primary-gold)'
                            }}
                            checked={isChecked}
                            disabled={selectionMode === 'auto'}
                            onChange={() => handleCheckboxToggle(art.originalUrl)}
                          />
                          <div style={{ flexGrow: 1 }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.4rem' }}>
                              {art.title}
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span style={{
                                background: 'rgba(234, 88, 12, 0.08)',
                                border: '1px solid rgba(234, 88, 12, 0.15)',
                                color: 'var(--primary-gold)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                {art.sourceName}
                              </span>
                              <span>
                                {art.pubDate ? new Date(art.pubDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : ''}
                              </span>
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-secondary)',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  padding: 0,
                                  fontSize: '0.75rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                                onClick={() => setExpandedArticleIdx(isExpanded ? null : idx)}
                              >
                                {isExpanded ? 'Hide Snippet' : 'View Snippet'}
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            </div>
                            
                            {/* Snippet display */}
                            {isExpanded && (
                              <div style={{
                                marginTop: '0.75rem',
                                background: 'rgba(0, 0, 0, 0.02)',
                                borderLeft: '3px solid var(--primary-gold)',
                                padding: '0.6rem 0.8rem',
                                borderRadius: '0 4px 4px 0',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)',
                                lineHeight: '1.4'
                              }}>
                                {art.snippet || 'No preview snippet available for this article.'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.formFooter} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStatus('idle')}
                >
                  <ArrowLeft size={16} />
                  Change Parameters
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={selectionMode === 'manual' && selectedArticleUrls.length === 0}
                  onClick={handleSynthesize}
                >
                  <Sparkles size={16} />
                  Generate Paraphrased Report
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Synthesis Progressive Loading timeline */}
          {status === 'loading' && (
            <div className="glass-panel animate-fade-in">
              <div className={styles.loadingContainer}>
                
                <div className={styles.loadingHeader}>
                  <div className="loading-spinner"></div>
                  <h2 className={styles.loadingTitle}>Synthesizing Mining News</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Compiling selected facts with Advanced AI. This takes about 10-15 seconds.
                  </p>
                </div>

                {/* Progress bar */}
                <div className={styles.progressWrapper}>
                  <div 
                    className={styles.progressBar} 
                    style={{ width: `${progressWidth}%` }}
                  ></div>
                </div>

                {/* Progress Timeline steps */}
                <div className={styles.timeline}>
                  {steps.map((step) => {
                    const isActive = loadingStep === step.id;
                    const isDone = loadingStep > step.id;
                    
                    return (
                      <div 
                        key={step.id} 
                        className={`${styles.timelineStep} ${isActive ? styles.timelineStepActive : ''} ${isDone ? styles.timelineStepDone : ''}`}
                      >
                        <div className={`${styles.stepIcon} ${isActive ? styles.stepIconActive : ''} ${isDone ? styles.stepIconDone : ''}`}>
                          {isDone ? <Check size={14} /> : step.id}
                        </div>
                        <span className={styles.stepText}>{step.text}</span>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>
          )}

          {/* STEP 5: Success Output Viewer */}
          {status === 'success' && (
            <div className={styles.resultWrapper}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button 
                  onClick={() => setStatus('selection')}
                  className="btn-secondary"
                >
                  <ArrowLeft size={16} />
                  Back to Selection Checklist
                </button>
                <button 
                  onClick={() => setStatus('idle')}
                  className="btn-secondary"
                >
                  New Report Parameters
                </button>
              </div>

              <div className={`glass-panel ${styles.resultContainer} animate-fade-in`}>
                {/* Result header bar */}
                <div className={styles.resultHeader}>
                  <div className={styles.resultHeaderLeft}>
                    <BookOpen size={20} style={{ color: 'var(--primary-gold)' }} />
                    <h2 className={styles.formHeaderTitle}>Synthesized News Report</h2>
                  </div>
                  <div className={styles.resultActions}>
                    <button 
                      onClick={handleCopy} 
                      className="btn-secondary" 
                      title="Copy to Clipboard"
                    >
                      <Copy size={16} />
                      Copy
                    </button>
                    <button 
                      onClick={handleDownload} 
                      className="btn-secondary" 
                      title="Download Markdown File"
                    >
                      <Download size={16} />
                      Download (.md)
                    </button>
                    <button 
                      onClick={handlePrint} 
                      className="btn-primary" 
                      title="Print / Export as PDF"
                    >
                      <FileText size={16} />
                      Print / PDF
                    </button>
                  </div>
                </div>

                {/* Result text */}
                <div className={styles.resultBody}>
                  <MarkdownRenderer markdown={synthesizedArticle} />
                </div>

                {/* Result sources */}
                {sources.length > 0 && (
                  <div className={styles.resultFooter}>
                    <h3 className={styles.sourcesTitle}>
                      <Globe size={16} style={{ color: 'var(--primary-gold)' }} />
                      Source References Synthesized ({sources.length})
                    </h3>
                    <div className={styles.sourcesGrid}>
                      {sources.map((src, idx) => (
                        <div key={idx} className={styles.sourceCard}>
                          <div>
                            <h4 className={styles.sourceTitle}>{src.title}</h4>
                            <div className={styles.sourceMeta}>
                              <span>{src.sourceName}</span>
                              <span>{src.pubDate ? new Date(src.pubDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : ''}</span>
                            </div>
                          </div>
                          <div style={{ marginTop: '0.75rem', alignSelf: 'flex-start' }}>
                            <a 
                              href={src.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className={styles.sourceLink}
                            >
                              View Source
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Error Card */}
          {status === 'error' && (
            <div className="glass-panel styles.errorCard animate-fade-in">
              <div className={styles.formHeader} style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <div className={styles.errorTitle}>
                  <AlertTriangle size={20} />
                  <span>Operation Failed</span>
                </div>
              </div>
              <div className={styles.formBody}>
                <p className={styles.errorText} style={{ marginBottom: '1.5rem' }}>
                  {errorMessage}
                </p>
                
                {/* Diagnostics recommendation box */}
                {(() => {
                  const diag = getErrorDiagnostics(errorMessage);
                  if (!diag) return null;
                  return (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.04)',
                      border: '1px dashed rgba(239, 68, 68, 0.3)',
                      padding: '1.2rem',
                      borderRadius: 'var(--border-radius-sm)',
                      marginBottom: '1.5rem',
                      fontSize: '0.9rem',
                      textAlign: 'left'
                    }}>
                      <div style={{ fontWeight: 600, color: 'rgb(239, 68, 68)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={16} />
                        {diag.title}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                        {diag.suggestion}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    onClick={() => setStatus('idle')} 
                    className="btn-secondary"
                  >
                    <ArrowLeft size={16} />
                    Adjust Parameters
                  </button>
                  <button 
                    onClick={errorPhase === 'search' ? () => handleSearch() : handleSynthesize} 
                    className="btn-primary"
                  >
                    <RefreshCw size={16} />
                    Retry {errorPhase === 'search' ? 'Search' : 'Synthesis'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>
          Your AME Relatives © {new Date().getFullYear()} — Premium Mining Industry Intelligence Aggregator
        </p>
        <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Powered by Advanced AI • RSS feeds parsed securely • Articles paraphrased dynamically
        </p>
      </footer>
    </div>
  );
}
