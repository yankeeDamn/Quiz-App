'use strict';

const { GdeltProvider } = require('./gdelt-provider');
const { RssProvider } = require('./rss-provider');
const { HackerNewsProvider } = require('./hackernews-provider');

// Singleton instances
const providers = {
  gdelt: new GdeltProvider(),
  rss: new RssProvider(),
  hackernews: new HackerNewsProvider(),
};

module.exports = { providers };
