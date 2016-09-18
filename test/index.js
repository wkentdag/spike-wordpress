require('dotenv').config({ silent: true })

const test = require('ava')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const Spike = require('spike-core')
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
    t.is(locals.wordpress.posts.length, 4)
    t.end()
  })
})

test.cb('works as a plugin to spike', (t) => {
  const projectPath = path.join(__dirname, 'fixtures/default')
  const project = new Spike({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'main.js')] }
  })

  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', () => {
    const src = fs.readFileSync(path.join(projectPath, 'public/index.html'), 'utf8')
    t.truthy(src === '<p>[object Object]</p><p>[object Object]</p><p>[object Object]</p><p>[object Object]</p>')  //  FIXME
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('fetches multiple postTypes', (t) => {
  const locals = {}
  const api = new Wordpress({
    name: process.env.NAME,
    addDataTo: locals,
    postTypes: ['interview', 'review']
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.wordpress.interview.length, 1)
    t.is(locals.wordpress.review.length, 2)
    t.end()
  })
})
