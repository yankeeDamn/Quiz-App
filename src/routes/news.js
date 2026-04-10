'use strict';

const { Router } = require('express');
const newsController = require('../controllers/news.controller');

const router = Router();

// GET /api/v1/news — list news articles with pagination, search, region, category filters
router.get('/', newsController.getNews);

// GET /api/v1/news/top — top/trending news
router.get('/top', newsController.getTopNews);

module.exports = router;
