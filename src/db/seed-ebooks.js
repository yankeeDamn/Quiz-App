"use strict";
const seeds = require("../../content/ebooks-starter.json");
async function seedEbooks(client) {
  for (const book of seeds) {
    await client.query(
      `INSERT INTO ebooks (slug,document,visibility) VALUES ($1,$2,'public') ON CONFLICT (slug) DO NOTHING`,
      [book.slug, JSON.stringify(book)],
    );
  }
}
module.exports = { seedEbooks };
