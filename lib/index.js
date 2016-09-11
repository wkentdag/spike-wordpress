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

const client = (site, opts) => {
  let url = `https://public-api.wordpress.com/rest/v1/sites/${site}`
  let _req = rest.wrap(mime, {mime: 'application/json'})
  .wrap(errorCode)
  .wrap(pathPrefix, {
    prefix: url
  })
  return _req(opts)
}

const fetch = (site, name, opts) => {
  //  TODO: merge name + opts and pass that as 2nd arg to client..
  //        or just refactor client/fetch so its less hacky/more intuitive
  return client(site, {path: `/${name}`})
  .then(r =>
    r.entity
  ).catch(err =>
    new Error(err)
  )
}

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
      let options
      let transformFn

      //  if it's just a string, apply default opts
      if (typeof pt === 'string') {
        name = pt
        options = {}
        transformFn = true
      } else {
        name = pt.name
        options = pt
        transformFn = pt.transform
      }

      if (typeof transformFn === 'boolean') {
        transformFn = transformFn ? transform : (x) => x
      }

      return W.resolve(fetch(this.name, name, options))
      .then(p => {
        m[name] = p.posts
        return Promise.resolve()
        // return W.map(p, transformFn)
      }).yield(m)
      // .tap(v => {
      //   console.log('vv')
      //   console.log(v)
      //   m[name] = v
      // })
      // .yield(m)
    }, {}).done(res => {
      // now we put the results on the data object
      // let modData = {}
      // if (this.hooks && this.hooks.postTransform) {
      //   [res, modData] = this.hooks.postTransform(res, this.addDataTo)
      //   this.addDataTo = Object.assign(this.addDataTo, modData)
      // }

      // just add to locals, don't ruin it
      this.addDataTo = Object.assign(this.addDataTo, { wordpress: res })
      // console.log(this.addDataTo)
      done()
    }, done)
  }
}

/**
 * @private
 */
function transform (post) {
  console.log(`transforming ${JSON.stringify(post, null, 2)}`)
  return post
}

/**
 * Validate options
 * @private
 */
function validate (opts = {}) {
  const schema = joi.object().keys({
    name: joi.string().required(),
    addDataTo: joi.object().required(),
    json: joi.string(),
    postTypes: joi.array().items(
    joi.string(), joi.object().keys({
      name: joi.string(),
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

function writeTemplate (pt, compiler, compilation, addDataTo, cb) {
  const data = addDataTo.wordpress[pt.name]
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
