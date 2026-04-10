'use strict';

const { BaseProvider } = require('./base-provider');
const logger = require('../utils/logger');

/**
 * Simple RSS/Atom XML parser (no external dependency).
 * Handles basic RSS 2.0 and Atom feeds.
 */
function parseRssXml(xml) {
  const items = [];

  // Try RSS 2.0 <item> tags
  const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const itemXml of itemMatches) {
    items.push({
      title: extractTag(itemXml, 'title'),
      link: extractTag(itemXml, 'link') || extractAttr(itemXml, 'link', 'href'),
      description: extractTag(itemXml, 'description'),
      pubDate: extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date'),
      author: extractTag(itemXml, 'author') || extractTag(itemXml, 'dc:creator'),
      category: extractTag(itemXml, 'category'),
      enclosure: extractAttr(itemXml, 'enclosure', 'url'),
    });
  }

  // Try Atom <entry> tags if no RSS items found
  if (items.length === 0) {
    const entryMatches = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    for (const entryXml of entryMatches) {
      items.push({
        title: extractTag(entryXml, 'title'),
        link: extractAttr(entryXml, 'link', 'href') || extractTag(entryXml, 'link'),
        description: extractTag(entryXml, 'summary') || extractTag(entryXml, 'content'),
        pubDate: extractTag(entryXml, 'published') || extractTag(entryXml, 'updated'),
        author: extractTag(entryXml, 'name'),
        category: extractAttr(entryXml, 'category', 'term'),
      });
    }
  }

  return items;
}

function extractTag(xml, tagName) {
  // Handle CDATA and regular content
  const regex = new RegExp(
    `<${tagName}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tagName}>`,
    'i'
  );
  const match = xml.match(regex);
  if (match) {
    const val = (match[1] || match[2] || '').trim();
    // Strip HTML tags for descriptions
    return val.replace(/<[^>]*>/g, '').trim();
  }
  return '';
}

function extractAttr(xml, tagName, attrName) {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}=["']([^"']*)["']`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

// Default RSS feeds organized by region
const DEFAULT_FEEDS = {
  global: [
    { url: 'https://feeds.bbci.co.uk/news/rss.xml', name: 'BBC News' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', name: 'NY Times' },
    { url: 'https://feeds.reuters.com/reuters/topNews', name: 'Reuters' },
  ],
  IN: [
    { url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', name: 'Times of India' },
    { url: 'https://www.thehindu.com/news/national/feeder/default.rss', name: 'The Hindu' },
    { url: 'https://indianexpress.com/feed/', name: 'Indian Express' },
    { url: 'https://feeds.feedburner.com/ndtvnews-top-stories', name: 'NDTV' },
  ],
};

class RssProvider extends BaseProvider {
  constructor() {
    super('RSS');
    this.feeds = DEFAULT_FEEDS;
  }

  async fetchArticles(options = {}) {
    const { region = '', page = 1, pageSize = 25, query = '' } = options;

    // Choose feeds based on region
    let feedList;
    if (region && region.toUpperCase() === 'IN') {
      feedList = [...this.feeds.IN, ...this.feeds.global.slice(0, 1)];
    } else {
      feedList = this.feeds.global;
    }

    // Fetch all feeds concurrently with individual error handling
    const feedResults = await Promise.allSettled(
      feedList.map((feed) => this._fetchFeed(feed))
    );

    let allArticles = [];
    for (const result of feedResults) {
      if (result.status === 'fulfilled') {
        allArticles = allArticles.concat(result.value);
      }
    }

    // Filter by query if provided
    if (query) {
      const q = query.toLowerCase();
      allArticles = allArticles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }

    // Sort by date (newest first)
    allArticles.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Paginate
    const start = (page - 1) * pageSize;
    return allArticles.slice(start, start + pageSize);
  }

  async _fetchFeed(feed) {
    try {
      logger.info({ feed: feed.name }, 'Fetching RSS feed');
      const response = await fetch(feed.url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'NewsAggregator/1.0',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });

      if (!response.ok) {
        logger.warn({ feed: feed.name, status: response.status }, 'RSS feed fetch failed');
        return [];
      }

      const xml = await response.text();
      const items = parseRssXml(xml);

      return items
        .filter((item) => item.title && item.link)
        .map((item) => ({
          id: `rss-${Buffer.from(item.link || item.title).toString('base64url').slice(0, 40)}`,
          title: item.title,
          url: item.link,
          source: 'RSS',
          sourceDomain: feed.name,
          description: (item.description || '').slice(0, 500),
          imageUrl: item.enclosure || '',
          author: item.author || feed.name,
          publishedAt: item.pubDate ? this._parseDate(item.pubDate) : new Date().toISOString(),
          category: item.category || '',
          region: feed.url.includes('india') || feed.url.includes('thehindu') || feed.url.includes('ndtv') ? 'IN' : '',
          language: 'English',
        }));
    } catch (err) {
      logger.warn({ feed: feed.name, error: err.message }, 'RSS feed error');
      return [];
    }
  }

  _parseDate(dateStr) {
    try {
      return new Date(dateStr).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}

module.exports = { RssProvider };
