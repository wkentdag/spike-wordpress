require('dotenv').config({ silent: true })

const test = require('ava')
const Wordpress = require('..')

const compilerMock = { options: { spike: { locals: {} } } }

test('errors without a "name"', (t) => {
  t.throws(
    () => { new Wordpress() }, // eslint-disable-line
    'ValidationError: [spike-wordpress constructor] option "name" is required'
  )
})

test('errors without "addDataTo"', (t) => {
  t.throws(
    () => { new Wordpress({ name: process.env.NAME}) }, // eslint-disable-line
    'ValidationError: [spike-wordpress constructor] option "addDataTo" is required'
  )
})

test('initializes with a name and addDataTo', (t) => {
  const wp = new Wordpress({ name: process.env.NAME, addDataTo: {} })
  t.truthy(wp)
})

test.cb('returns valid content', (t) => {
  const locals = {}
  const api = new Wordpress({
    name: process.env.NAME,
    addDataTo: locals
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.wordpress.posts.length, 3)
    t.end()
  })
})
