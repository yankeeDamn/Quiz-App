'use strict';

/**
 * @typedef {Object} Article
 * @property {string} id - Unique identifier
 * @property {string} title - Article title
 * @property {string} url - Original article URL
 * @property {string} source - Source name (e.g., 'GDELT', 'RSS', 'HackerNews')
 * @property {string} [description] - Article description/summary
 * @property {string} [imageUrl] - Article image URL
 * @property {string} [author] - Author name
 * @property {string} publishedAt - ISO 8601 timestamp
 * @property {string} [category] - Article category
 * @property {string} [region] - Region code (e.g., 'IN', 'US')
 * @property {string} [language] - Language code
 */

/**
 * @typedef {Object} FetchOptions
 * @property {number} [page] - Page number (1-indexed)
 * @property {number} [pageSize] - Number of articles per page
 * @property {string} [query] - Search query
 * @property {string} [region] - Region filter (e.g., 'IN')
 * @property {string} [category] - Category filter
 * @property {string} [sortBy] - Sort field (default: 'publishedAt')
 * @property {string} [sortOrder] - Sort order ('desc' or 'asc')
 * @property {number} [timeWindowHours] - Rolling time window in hours
 */

class BaseProvider {
  constructor(name) {
    this.name = name;
    this.lastFetchTime = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelayMs = 1000;
  }

  /**
   * Fetch articles from this provider.
   * @param {FetchOptions} options
   * @returns {Promise<Article[]>}
   */
  async fetchArticles(_options) {
    throw new Error(`fetchArticles() not implemented in ${this.name}`);
  }

  /**
   * Fetch with retry logic.
   * @param {FetchOptions} options
   * @returns {Promise<Article[]>}
   */
  async fetchWithRetry(options) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const articles = await this.fetchArticles(options);
        this.retryCount = 0;
        this.lastFetchTime = new Date().toISOString();
        return articles;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    // All retries exhausted — return empty array as fallback
    const logger = require('../utils/logger');
    logger.error(
      { provider: this.name, error: lastError?.message },
      `Provider ${this.name} failed after ${this.maxRetries + 1} attempts`
    );
    return [];
  }
}

module.exports = { BaseProvider };
