const Wordpress = require('../../..')
const standard = require('reshape-standard')
const locals = {}

module.exports = {
  matchers: { html: '*(**/)*.sgr' },
  reshape: (ctx) => standard({ webpack: ctx, locals }),
  plugins: [new Wordpress({
    name: process.env.NAME,
    addDataTo: locals,
    json: 'data.json'
  })]
}
