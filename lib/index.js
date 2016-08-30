const joi = require('joi')
const rest = require('rest')
const mime = require('rest/interceptor/mime')
const errorCode = require('rest/interceptor/errorCode')
const pathPrefix = require('rest/interceptor/pathPrefix')

const client = rest.wrap(mime, {mime: 'application/json'})
  .wrap(errorCode)
  .wrap(pathPrefix, {prefix: 'https://public-api.wordpress.com/rest/v1/sites/'})

const fetch = (name, opts) => {
  return client({path: `${name}/posts`, params: opts})
  .then(r => r.entity)
}

module.exports = class Wordpress {
  constructor (_opts) {
    const opts = validate(_opts)
    Object.assign(this, opts)
  }

  run (compiler, compilation, done) {
    fetch(this.name, this.opts)
    .then(r => {
      this.addDataTo = Object.assign(this.addDataTo, { wordpress: r })
      done()
    })
    .catch(err => {
      console.error(err)
      throw new Error(err)
    })
  }
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

// function writeTemplate (ct, compiler, compilation, addDataTo, cb) {
//   const data = addDataTo.wordpress[ct.name]
//   const filePath = path.join(compiler.options.context, ct.template.path)
//
//   return node.call(fs.readFile.bind(fs), filePath, 'utf8').then((template) => {
//     return W.map(data, (item) => {
//       addDataTo = Object.assign(addDataTo, { item: item })
//       compiler.resourcePath = filePath
//
//       // webpack context is used by default in spike for plugins, so we need
//       // to mock it so that plugins dont crash
//       const fakeContext = { addDependency: (x) => x, resourcePath: filePath }
//       const options = loader.parseOptions.call(fakeContext, compiler.options.reshape)
//
//       // W.map fires events as quickly as possible, so the locals will be
//       // swapped for the last item unless bound to the result function
//       return reshape(options)
//         .process(template)
//         .then(((locals, res) => {
//           const html = res.output(locals)
//           compilation.assets[ct.template.output(item)] = {
//             source: () => html,
//             size: () => html.length
//           }
//         }).bind(null, Object.assign({}, options.locals)), cb)
//     })
//   })
// }
