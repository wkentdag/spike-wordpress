require('dotenv').config({ silent: true })

const test = require('ava')
const Wordpress = require('..')
const Spike = require('spike-core')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const standard = require('reshape-standard')

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

test.cb('implements query params', (t) => {
  const locals = {}
  const api = new Wordpress({
    name: process.env.NAME,
    addDataTo: locals,
    postTypes: [{
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
    name: process.env.NAME,
    addDataTo: locals,
    postTypes: [{
      category: 'review',
      search: 'wow'
    }]
  })

  api.run(compilerMock, undefined, () => {
    t.is(locals.wordpress.review[0].id, 6)
    t.is(locals.wordpress.review[0].author.name, 'wkentdag')
    t.truthy(Object.keys(locals.wordpress.review[0].categories[0]).length === 2)
    t.end()
  })
})

test.cb('implements custom transform function', (t) => {
  const locals = {}
  const api = new Wordpress({
    name: process.env.NAME,
    addDataTo: locals,
    postTypes: [{
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
    name: process.env.NAME,
    addDataTo: locals,
    postTypes: [{
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
    t.end
  })
  project.on('warning', t.end)
  project.on('compile', () => {
    const file1 = fs.readFileSync(path.join(projectPath, 'public/posts/my-nice-review.html'), 'utf8')
    const file2 = fs.readFileSync(path.join(projectPath, 'public/posts/my-second-review.html'), 'utf8')
    t.is(file1.trim(), '<p>6</p>')
    t.is(file2.trim(), '<p>8</p>')
    rimraf.sync(path.join(projectPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('hooks :: postTransform modifies posts', (t) => {
  const locals = {}
  const api = new Wordpress({
    name: process.env.NAME,
    addDataTo: locals,
    postTypes: ['review'],
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
    name: process.env.NAME,
    addDataTo: locals,
    postTypes: ['review'],
    hooks: {
      postTransform: (posts, locals) => {
        return [posts, { foo: 'bar' }]
      }
    }
  })

  api.run(compilerMock, undefined, () => {
    // console.log(JSON.stringify(locals,null,2))
    t.is(locals.foo, 'bar')
    t.is(locals.wordpress.review[0].id, 8)
    t.end()
  })
})

test.cb('hooks :: postTransform does not overwrite locals', (t) => {
  const locals = { foo: 'bar' }
  const api = new Wordpress({
    name: process.env.NAME,
    addDataTo: locals,
    postTypes: ['review'],
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
