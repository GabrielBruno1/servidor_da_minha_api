// .puppeteerrc.cjs
const { join } = require('path');

/** @type {import("puppeteer").Configuration} */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),  // Cache local no projeto (persiste no Render)
};
