const SpikeUtil = require('spike-util')
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
const he = require('he')

module.exports = class Wordpress {
  constructor (opts) {
    Object.assign(this, validate(opts))
  }

  apply (compiler) {
    this.util = new SpikeUtil(compiler.options)
    this.util.runAll(compiler, this.run.bind(this, compiler))

    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('normal-module-loader', (loaderContext) => {
        this.loaderContext = loaderContext
      })
    })

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
        return writeTemplate(compiler, compilation, this.loaderContext, this.addDataTo, this.util, pt)
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
      .then((data) =>
        W.map(data.posts, (item) => {
          if (pt.template) {
            const outputPath = pt.template.output(item)
            Object.assign(item, {_url: `/${outputPath.slice(0, -5)}`})
          }
          return transformFn(item)
        })
      )
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
  return W.promise(resolve => {
    let url = `https://public-api.wordpress.com/rest/v1/sites/${site}/posts`

    let client = rest.wrap(mime, {mime: 'application/json'})
    .wrap(errorCode)
    .wrap(pathPrefix, { prefix: url })
    .wrap(params, { params: opts })

    client()
    .then(r => {
      //  escape ascii in the post title
      r.entity.posts.map(p => {
        p.title = he.decode(p.title)
      })
      resolve(r.entity)
    })
  })
}

//  default transform function applied to each post
const transform = (post) => {
  let leanPost = {}
  let relevant = ['ID', 'author', 'date', 'modified', 'title', 'URL', 'content', 'excerpt', 'slug', 'status', 'type', 'comment_count', 'featured_image', 'tags', 'categories', 'attachments', '_url']

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
        transform: joi.alternatives().try(joi.boolean(), joi.func()).default(true),
        template: joi.object().keys({path: joi.string().required(), output: joi.func().required()})
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

const writeTemplate = (compiler, compilation, loaderContext, addDataTo, util, pt) => {
  const data = addDataTo.wordpress[pt.name]
  const filePath = path.join(compiler.options.context, pt.template.path)

  return node.call(fs.readFile.bind(fs), filePath, 'utf8').then((template) => {
    return W.map(data, (item) => {
      const newLocals = Object.assign({}, addDataTo, { item })
      const options = loader.parseOptions.call(loaderContext, util.getSpikeOptions().reshape, {})

      return reshape(options)
      .process(template)
      .then((res) => {
        const html = res.output(newLocals)
        compilation.assets[pt.template.output(item)] = {
          source: () => html,
          size: () => html.length
        }
      })
    })
  })
}
