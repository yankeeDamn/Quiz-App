'use strict';

const { BaseProvider } = require('./base-provider');
const logger = require('../utils/logger');

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';

class HackerNewsProvider extends BaseProvider {
  constructor() {
    super('HackerNews');
  }

  async fetchArticles(options = {}) {
    const { page = 1, pageSize = 25, query = '' } = options;

    logger.info({ page, pageSize }, 'HackerNews fetch');

    // Fetch top story IDs
    const response = await fetch(`${HN_API_BASE}/topstories.json`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`HN API error: ${response.status}`);
    }

    const storyIds = await response.json();

    // Paginate story IDs
    const start = (page - 1) * pageSize;
    const selectedIds = storyIds.slice(start, start + pageSize);

    // Fetch story details concurrently (batch of pageSize)
    const storyResults = await Promise.allSettled(
      selectedIds.map((id) => this._fetchStory(id))
    );

    let articles = [];
    for (const result of storyResults) {
      if (result.status === 'fulfilled' && result.value) {
        articles.push(result.value);
      }
    }

    // Filter by query
    if (query) {
      const q = query.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }

    return articles;
  }

  async _fetchStory(id) {
    try {
      const response = await fetch(`${HN_API_BASE}/item/${id}.json`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return null;

      const story = await response.json();
      if (!story || story.type !== 'story' || !story.title) return null;

      return {
        id: `hn-${story.id}`,
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        source: 'HackerNews',
        sourceDomain: story.url ? new URL(story.url).hostname : 'news.ycombinator.com',
        description: story.text
          ? story.text.replace(/<[^>]*>/g, '').slice(0, 500)
          : `${story.score || 0} points | ${story.descendants || 0} comments`,
        imageUrl: '',
        author: story.by || 'anonymous',
        publishedAt: story.time
          ? new Date(story.time * 1000).toISOString()
          : new Date().toISOString(),
        category: 'Technology',
        region: '',
        language: 'English',
      };
    } catch (err) {
      logger.warn({ storyId: id, error: err.message }, 'HN story fetch error');
      return null;
    }
  }
}

module.exports = { HackerNewsProvider };
