'use strict';

const { providers } = require('../providers');
const logger = require('../utils/logger');

/**
 * De-duplicate articles by URL and similar titles.
 * Uses URL as primary key, with fuzzy title matching as secondary.
 */
function deduplicateArticles(articles) {
  const seen = new Map(); // url -> article
  const titleIndex = new Map(); // normalized title prefix -> url

  const result = [];

  for (const article of articles) {
    // Skip if URL already seen
    if (article.url && seen.has(article.url)) {
      continue;
    }

    // Check for similar titles (first 60 chars, normalized)
    const normalizedTitle = article.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .slice(0, 60);

    if (normalizedTitle.length > 10 && titleIndex.has(normalizedTitle)) {
      continue;
    }

    seen.set(article.url, article);
    if (normalizedTitle.length > 10) {
      titleIndex.set(normalizedTitle, article.url);
    }
    result.push(article);
  }

  return result;
}

/**
 * Filter articles within a rolling time window.
 */
function filterByTimeWindow(articles, windowHours = 48) {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  return articles.filter((a) => {
    try {
      return new Date(a.publishedAt) >= cutoff;
    } catch {
      return true; // Keep articles with unparseable dates
    }
  });
}

/**
 * Fetch and merge articles from all providers.
 */
async function getNews(options = {}) {
  const {
    page = 1,
    pageSize = 20,
    query = '',
    region = '',
    category = '',
    timeWindowHours = 48,
    sortBy = 'publishedAt',
    sortOrder = 'desc',
  } = options;

  logger.info({ page, pageSize, query, region, category }, 'Fetching news');

  const fetchOpts = { page, pageSize: Math.ceil(pageSize * 1.5), query, region, category, timeWindowHours };

  // Fetch from all providers concurrently with fallback
  const results = await Promise.allSettled([
    providers.gdelt.fetchWithRetry(fetchOpts),
    providers.rss.fetchWithRetry(fetchOpts),
    providers.hackernews.fetchWithRetry({ ...fetchOpts, pageSize: Math.ceil(pageSize * 0.5) }),
  ]);

  let allArticles = [];
  const sourceStats = {};

  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      for (const article of result.value) {
        allArticles.push(article);
        sourceStats[article.source] = (sourceStats[article.source] || 0) + 1;
      }
    }
  }

  logger.info({ sourceStats, totalRaw: allArticles.length }, 'Raw articles collected');

  // Filter by time window
  allArticles = filterByTimeWindow(allArticles, timeWindowHours);

  // Filter by category
  if (category && category.toLowerCase() === 'india') {
    allArticles = allArticles.filter(
      (a) =>
        a.region === 'IN' ||
        a.title.toLowerCase().includes('india') ||
        a.title.toLowerCase().includes('indian') ||
        a.description.toLowerCase().includes('india')
    );
  }

  // De-duplicate
  allArticles = deduplicateArticles(allArticles);

  // Sort
  allArticles.sort((a, b) => {
    const dateA = new Date(a[sortBy] || a.publishedAt).getTime();
    const dateB = new Date(b[sortBy] || b.publishedAt).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  // Final pagination (since we over-fetched)
  const totalArticles = allArticles.length;
  const startIdx = (page - 1) * pageSize;
  const paginatedArticles = allArticles.slice(startIdx, startIdx + pageSize);

  return {
    articles: paginatedArticles,
    pagination: {
      page,
      pageSize,
      total: totalArticles,
      totalPages: Math.ceil(totalArticles / pageSize),
      hasMore: startIdx + pageSize < totalArticles,
    },
    sources: sourceStats,
  };
}

/**
 * Get top/trending news.
 */
async function getTopNews(options = {}) {
  return getNews({
    ...options,
    pageSize: options.pageSize || 10,
    timeWindowHours: 24,
  });
}

module.exports = { getNews, getTopNews };
