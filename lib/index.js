const joi = require('joi')
const W = require('when')
const node = require('when/node')
const rest = require('rest')
const params = require('rest/interceptor/params')
const mime = require('rest/interceptor/mime')
const errorCode = require('rest/interceptor/errorCode')
const pathPrefix = require('rest/interceptor/pathPrefix')
const reshape = require('reshape')
const loader = require('reshape-loader')
const path = require('path')
const fs = require('fs')
const pickBy = require('lodash.pickby')

module.exports = class Wordpress {
  constructor (_opts) {
    const opts = validate(_opts)
    Object.assign(this, opts)
  }

  apply (compiler) {
    compiler.plugin('run', this.run.bind(this, compiler))
    compiler.plugin('watch-run', this.run.bind(this, compiler))
    compiler.plugin('emit', (compilation, done) => {
      if (this.json) {
        const src = JSON.stringify(this.addDataTo.wordpress, null, 2)
        compilation.assets[this.json] = {
          source: () => src,
          size: () => src.length
        }
      }

      const templateContent = this.posts.filter((pt) => {
        return pt.template
      })

      W.map(templateContent, (pt) => {
        return writeTemplate(pt, compiler, compilation, this.addDataTo, done)
      }).done(() => done(), done)
    })
  }

  run (compiler, compilation, done) {
    return W.reduce(this.posts, (m, pt) => {
      let name
      let params
      let transformFn

      //  if it's just a string, construct the default object
      if (typeof pt === 'string') {
        name = pt
        transformFn = true
      //  ..otherwise pass in the user config object and pull local variables from it
      } else {
        name = pt.name
        transformFn = pt.transform
        params = pickBy(pt, (value, key) => { return (key !== 'name' && key !== 'transform') })
      }

      if (typeof transformFn === 'boolean') {
        transformFn = transformFn ? transform : (x) => x
      }

      return W.resolve(fetch(this.site, params))
      .then((pt) => W.map(pt.posts, transformFn))
      .tap((v) => { m[name] = v })
      .yield(m)
    }, {}).done(res => {
      // now we put the results on the data object
      let modData = {}
      if (this.hooks && this.hooks.postTransform) {
        [res, modData] = this.hooks.postTransform(res, this.addDataTo)
        this.addDataTo = Object.assign(this.addDataTo, modData)
      }

      // just add to locals, don't ruin it
      this.addDataTo = Object.assign(this.addDataTo, { wordpress: res })
      done()
    }, done)
  }
}

//  hit the wp api
const fetch = (site, opts) => {
  let url = `https://public-api.wordpress.com/rest/v1/sites/${site}/posts`

  let client = rest.wrap(mime, {mime: 'application/json'})
  .wrap(errorCode)
  .wrap(pathPrefix, { prefix: url })
  .wrap(params, { params: opts })

  return client().then(r => r.entity)
}

//  default transform function applied to each post
const transform = (post) => {
  let leanPost = {}
  let relevant = ['ID', 'author', 'date', 'modified', 'title', 'URL', 'content', 'excerpt', 'slug', 'status', 'type', 'comment_count', 'featured_image', 'tags', 'categories', 'attachments']

  Object.keys(post).filter(prop => relevant.includes(prop)).forEach(prop => {
    switch (prop) {
      case 'author':
        Object.assign(leanPost, {
          author: {
            name: post.author.name,
            full_name: `${post.author.first_name} ${post.author.last_name}`,
            avatar: post.author.avatar_URL
          }
        })
        break

      case 'categories':
        let trimmed = Object.keys(post.categories).map(p => {
          let cat = post.categories[p]
          return {
            name: cat.name,
            post_count: cat.post_count
          }
        })
        Object.assign(leanPost, {categories: trimmed})
        break

      default:
        leanPost[`${prop.toLowerCase()}`] = post[prop]
        return
    }
  })
  return leanPost
}

/**
 * Validate options
 * @private
 */
const validate = (opts = {}) => {
  const schema = joi.object().keys({
    site: joi.string().required(),
    addDataTo: joi.object().required(),
    json: joi.string(),
    hooks: joi.object().keys({
      postTransform: joi.func()
    }),
    posts: joi.array().items(
      joi.string(), joi.object().keys({
        name: joi.string().required(),
        transform: joi.alternatives().try(joi.boolean(), joi.func()).default(true)
      })
    ).default(['posts'])
  })

  const res = joi.validate(opts, schema, {
    allowUnknown: true,
    language: {
      messages: { wrapArrays: false },
      object: { child: '!![spike-wordpress constructor] option {{reason}}' }
    }
  })

  if (res.error) { throw new Error(res.error) }
  return res.value
}

const writeTemplate = (pt, compiler, compilation, addDataTo, cb) => {
  const data = addDataTo.wordpress[pt.category]
  const filePath = path.join(compiler.options.context, pt.template.path)

  return node.call(fs.readFile.bind(fs), filePath, 'utf8').then((template) => {
    return W.map(data, (item) => {
      addDataTo = Object.assign(addDataTo, { item: item })
      compiler.resourcePath = filePath

      // webpack context is used by default in spike for plugins, so we need
      // to mock it so that plugins dont crash
      const fakeContext = { addDependency: (x) => x, resourcePath: filePath }
      const options = loader.parseOptions.call(fakeContext, compiler.options.reshape)

      // W.map fires events as quickly as possible, so the locals will be
      // swapped for the last item unless bound to the result function
      return reshape(options)
        .process(template)
        .then(((locals, res) => {
          const html = res.output(locals)
          compilation.assets[pt.template.output(item)] = {
            source: () => html,
            size: () => html.length
          }
        }).bind(null, Object.assign({}, options.locals)), cb)
    })
  })
}
