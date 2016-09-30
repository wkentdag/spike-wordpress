const joi = require('joi')
const W = require('when')
const node = require('when/node')
const rest = require('rest')
const mime = require('rest/interceptor/mime')
const errorCode = require('rest/interceptor/errorCode')
const pathPrefix = require('rest/interceptor/pathPrefix')
const reshape = require('reshape')
const loader = require('reshape-loader')
const path = require('path')
const fs = require('fs')

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

      const templateContent = this.postTypes.filter((pt) => {
        return pt.template
      })

      W.map(templateContent, (pt) => {
        return writeTemplate(pt, compiler, compilation, this.addDataTo, done)
      }).done(() => done(), done)
    })
  }

  run (compiler, compilation, done) {
    return W.reduce(this.postTypes, (m, pt) => {
      let name
      let params
      let transformFn

      //  if it's just a string, construct the default object
      if (typeof pt === 'string') {
        name = pt
        transformFn = true
        if (pt !== 'posts') {
          params = {category: pt}
        }
      //  ..otherwise pass in the user config object and pull local variables from it
      } else {
        name = pt.category
        transformFn = pt.transform
        params = pt
      }

      if (typeof transformFn === 'boolean') {
        transformFn = transformFn ? transform : (x) => x
      }

      return W.resolve(fetch(this.name, params))
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
const fetch = (site, params) => {
  let url = `https://public-api.wordpress.com/rest/v1/sites/${site}/posts${serialize(params)}`

  let client = rest.wrap(mime, {mime: 'application/json'})
  .wrap(errorCode)
  .wrap(pathPrefix, {
    prefix: url
  })

  return client({
    params: params  //  FIXME: why doesn't this work?
  })
  .then(r =>
    r.entity
  ).catch(err => {
    console.error(err)
    return new Error(err)  //  FIXME: make this error reject the promise
  })
}

//  serialize an object into a query param string. temporary hack to get around rest.js params not sticking...
const serialize = (params) => {
  let whitelist = ['category', 'order', 'search', 'number']

  return (!params) ? '' : '?' + Object.keys(params)
  .filter(p => whitelist.includes(p))
  .map(p => `${p}=${params[p]}&`)
  .reduce((p, c) => p + c)
  .slice(0, -1)
}

//  default transform function applied to each post
const transform = (post) => {
  let author = {
    name: post.author.name,
    full_name: `${post.author.first_name} ${post.author.last_name}`,
    avatar: post.author.avatar_URL
  }
  post.id = post.ID
  delete post.ID
  post.author = author
  return post
}

/**
 * Validate options
 * @private
 */
const validate = (opts = {}) => {
  const schema = joi.object().keys({
    name: joi.string().required(),
    addDataTo: joi.object().required(),
    json: joi.string(),
    hooks: joi.object().keys({
      postTransform: joi.func()
    }),
    postTypes: joi.array().items(
      joi.string(), joi.object().keys({
        category: joi.string().required(),
        order: joi.string(),
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
