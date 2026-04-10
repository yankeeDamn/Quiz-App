'use strict';

const newsService = require('../services/news.service');
const logger = require('../utils/logger');

/**
 * GET /api/v1/news
 * Query params: page, pageSize, query, region, category, sortBy, sortOrder
 */
async function getNews(req, res, next) {
  try {
    const {
      page = '1',
      pageSize = '20',
      query = '',
      region = '',
      category = '',
      sortBy = 'publishedAt',
      sortOrder = 'desc',
    } = req.query;

    const result = await newsService.getNews({
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20)),
      query: String(query).slice(0, 200),
      region: String(region).slice(0, 10),
      category: String(category).slice(0, 50),
      sortBy,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    });

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    logger.error({ error: err.message }, 'Error fetching news');
    next(err);
  }
}

/**
 * GET /api/v1/news/top
 * Query params: region, pageSize
 */
async function getTopNews(req, res, next) {
  try {
    const { region = '', pageSize = '10' } = req.query;

    const result = await newsService.getTopNews({
      region: String(region).slice(0, 10),
      pageSize: Math.min(50, Math.max(1, parseInt(pageSize, 10) || 10)),
    });

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    logger.error({ error: err.message }, 'Error fetching top news');
    next(err);
  }
}

module.exports = { getNews, getTopNews };
