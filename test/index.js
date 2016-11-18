require('dotenv').config({path: `${__dirname}/.env`})

const test = require('ava')
const Wordpress = require('..')
const Spike = require('spike-core')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const standard = require('reshape-standard')

const compilerMock = { options: { spike: { locals: {} } } }

test('constructor :: errors without a "site"', (t) => {
  t.throws(
    () => { new Wordpress() }, // eslint-disable-line
    'ValidationError: [spike-wordpress constructor] option "site" is required'
  )
})

test('constructor :: errors without "addDataTo"', (t) => {
  t.throws(
    () => { new Wordpress({ site: process.env.SITE}) }, // eslint-disable-line
    'ValidationError: [spike-wordpress constructor] option "addDataTo" is required'
  )
})

test('constructor :: errors with a config object with no name', (t) => {
  t.throws(
    () => { new Wordpress({ site: process.env.SITE, addDataTo: {}, posts: [{name: 'foo', category: 'blah'}, {category: 'wow'}] }) }, //  eslint-disable-line
    'ValidationError: [spike-wordpress constructor] option "posts" at position 1 does not match any of the allowed types'
  )
})

test('constructor :: initializes with a site and addDataTo', (t) => {
  const wp = new Wordpress({ site: process.env.SITE, addDataTo: {} })
  t.truthy(wp)
})

test.cb('returns valid content', (t) => {
  const locals = {}
  const api = new Wordpress({
    site: process.env.SITE,
    addDataTo: locals
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.wordpress.posts.length, 5)
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
    t.truthy(src === '<p>11</p><p>8</p><p>6</p><p>4</p><p>1</p>')
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('fetches multiple posts', (t) => {
  const locals = {}
  const api = new Wordpress({
    site: process.env.SITE,
    addDataTo: locals,
    posts: [
      { name: 'interviews', category: 'interview' },
      { name: 'reviews', category: 'review' }
    ]
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.wordpress.interviews.length, 1)
    t.is(locals.wordpress.reviews.length, 2)
    t.end()
  })
})

test.cb('implements query params', (t) => {
  const locals = {}
  const api = new Wordpress({
    site: process.env.SITE,
    addDataTo: locals,
    posts: [{
      name: 'review',
      category: 'review',
      search: 'wow'
    }]
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.wordpress.review.length, 1)
    t.is(locals.wordpress.review[0].slug, 'my-nice-review')
    t.end()
  })
})

test.cb('implements default transform function', (t) => {
  const locals = {}
  const api = new Wordpress({
    site: process.env.SITE,
    addDataTo: locals,
    posts: [{
      name: 'review',
      category: 'review',
      search: 'wow'
    }]
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.wordpress.review[0].id, 4)
    t.is(locals.wordpress.review[0].author.name, 'wkd')
    t.truthy(locals.wordpress.review[0].categories[0].name === 'review')
    t.end()
  })
})

test.cb('implements custom transform function', (t) => {
  const locals = {}
  const api = new Wordpress({
    site: process.env.SITE,
    addDataTo: locals,
    posts: [{
      name: 'review',
      category: 'review',
      search: 'wow',
      transform: (post) => {
        post.foo = 'bar'
        return post
      }
    }]
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.wordpress.review.length, 1)
    t.is(locals.wordpress.review[0].foo, 'bar')
    t.end()
  })
})

test.cb('properly escapes html', (t) => {
  const locals = {}
  const api = new Wordpress({
    site: process.env.SITE,
    addDataTo: locals,
    posts: [{
      name: 'posts',
      search: 'weird',
      transform: (post) => {
        post.foo = 'bar'
        return post
      }
    }]
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.wordpress.posts[0].title, 'a title: it’s has “weird” characters')
    t.is(locals.wordpress.posts[0].foo, 'bar')
    t.end()
  })
})

test.cb('writes json output', (t) => {
  const projectPath = path.join(__dirname, 'fixtures/json')
  const project = new Spike({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'main.js')] }
  })

  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', () => {
    const file = path.join(projectPath, 'public/data.json')
    t.falsy(fs.accessSync(file))
    const src = JSON.parse(fs.readFileSync(path.join(projectPath, 'public/data.json'), 'utf8'))
    t.truthy(src.posts.length > 1)
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('accepts template object and generates html', (t) => {
  const locals = {}
  const wordpress = new Wordpress({
    site: process.env.SITE,
    addDataTo: locals,
    posts: [{
      name: 'review',
      category: 'review',
      template: {
        path: '../template/template.sgr',
        output: (item) => `posts/${item.slug}.html`
      }
    }]
  })

  const projectPath = path.join(__dirname, 'fixtures/default')
  const project = new Spike({
    root: projectPath,
    reshape: (ctx) => standard({ webpack: ctx, locals }),
    entry: { main: [path.join(projectPath, 'main.js')] },
    plugins: [wordpress]
  })

  project.on('error', (e) => {
    console.error(e)
    t.end()
  })
  project.on('warning', t.end)
  project.on('compile', () => {
    const file1 = fs.readFileSync(path.join(projectPath, 'public/posts/my-nice-review.html'), 'utf8')
    const file2 = fs.readFileSync(path.join(projectPath, 'public/posts/my-second-review.html'), 'utf8')
    t.is(file1.trim(), '<p>4</p>')
    t.is(file2.trim(), '<p>6</p>')
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('hooks :: postTransform modifies posts', (t) => {
  const locals = {}
  const api = new Wordpress({
    site: process.env.SITE,
    addDataTo: locals,
    hooks: {
      postTransform: (posts, locals) => {
        return [{posts: 'foo'}, {}]
      }
    }
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.wordpress.posts, 'foo')
    t.end()
  })
})

test.cb('hooks :: postTransform adds to locals', (t) => {
  const locals = {}
  const api = new Wordpress({
    site: process.env.SITE,
    addDataTo: locals,
    hooks: {
      postTransform: (posts, locals) => {
        return [posts, { foo: 'bar' }]
      }
    }
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.foo, 'bar')
    t.is(locals.wordpress.posts[0].id, 11)
    t.end()
  })
})

test.cb('hooks :: postTransform does not overwrite locals', (t) => {
  const locals = { foo: 'bar' }
  const api = new Wordpress({
    site: process.env.SITE,
    addDataTo: locals,
    hooks: {
      postTransform: (posts, locals) => {
        return [posts, {}]
      }
    }
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.foo, 'bar')
    t.end()
  })
})
