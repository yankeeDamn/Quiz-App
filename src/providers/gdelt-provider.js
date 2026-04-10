'use strict';

const { BaseProvider } = require('./base-provider');
const logger = require('../utils/logger');

const GDELT_API_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

class GdeltProvider extends BaseProvider {
  constructor() {
    super('GDELT');
  }

  /**
   * Build GDELT query URL.
   */
  _buildUrl(options = {}) {
    const {
      query = '',
      region = '',
      page = 1,
      pageSize = 25,
      timeWindowHours = 48,
      category = '',
    } = options;

    const params = new URLSearchParams();
    params.set('format', 'json');
    params.set('maxrecords', String(pageSize));
    params.set('sort', 'DateDesc');
    params.set('timespan', `${timeWindowHours}h`);

    // Build the query string
    let q = query || '';

    if (region && region.toUpperCase() === 'IN') {
      q = q ? `${q} sourcelang:eng sourcecountry:IN` : 'sourcelang:eng sourcecountry:IN';
    } else if (region) {
      q = q ? `${q} sourcecountry:${region.toUpperCase()}` : `sourcecountry:${region.toUpperCase()}`;
    }

    if (category && category.toLowerCase() === 'india') {
      q = q ? `${q} india OR indian` : 'india OR indian';
    }

    if (!q) {
      q = 'sourcelang:eng';
    }

    params.set('query', q);

    // GDELT doesn't have native pagination so we use startdatetime offset
    if (page > 1) {
      const offsetHours = Math.min((page - 1) * 6, timeWindowHours - 6);
      const now = new Date();
      const endTime = new Date(now.getTime() - offsetHours * 60 * 60 * 1000);
      const y = endTime.getUTCFullYear();
      const m = String(endTime.getUTCMonth() + 1).padStart(2, '0');
      const d = String(endTime.getUTCDate()).padStart(2, '0');
      const h = String(endTime.getUTCHours()).padStart(2, '0');
      const min = String(endTime.getUTCMinutes()).padStart(2, '0');
      const s = String(endTime.getUTCSeconds()).padStart(2, '0');
      params.set('ENDDATETIME', `${y}${m}${d}${h}${min}${s}`);
    }

    return `${GDELT_API_BASE}?${params.toString()}`;
  }

  async fetchArticles(options = {}) {
    const url = this._buildUrl(options);
    logger.info({ url }, 'GDELT fetch');

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`GDELT API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const articles = data.articles || [];

    return articles.map((a) => ({
      id: `gdelt-${Buffer.from(a.url || '').toString('base64url').slice(0, 40)}`,
      title: a.title || 'Untitled',
      url: a.url || '',
      source: 'GDELT',
      sourceDomain: a.domain || '',
      description: a.seendate ? `Published on ${a.seendate}` : '',
      imageUrl: a.socialimage || '',
      author: a.domain || '',
      publishedAt: a.seendate ? this._parseGdeltDate(a.seendate) : new Date().toISOString(),
      category: a.theme ? a.theme.split(';')[0] : '',
      region: options.region || '',
      language: a.language || 'English',
    }));
  }

  _parseGdeltDate(dateStr) {
    try {
      // GDELT format: "20250409T120000Z" or "2025-04-09T12:00:00Z"
      if (dateStr.includes('T') && !dateStr.includes('-')) {
        const y = dateStr.slice(0, 4);
        const m = dateStr.slice(4, 6);
        const d = dateStr.slice(6, 8);
        const h = dateStr.slice(9, 11);
        const min = dateStr.slice(11, 13);
        const s = dateStr.slice(13, 15);
        return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString();
      }
      return new Date(dateStr).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}

module.exports = { GdeltProvider };
