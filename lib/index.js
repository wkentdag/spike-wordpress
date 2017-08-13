const Client =  require( 'wpapi' );
const Joi = require('joi')
const W = require('when')
const fs = require('fs')
const path = require('path')
const node = require('when/node')
const reshape = require('reshape')
const loader = require('reshape-loader')
const SpikeUtil = require('spike-util')

class Wordpress {
  constructor (opts) {
    const validatedOptions = validate(opts)
    Object.assign(this, validatedOptions)
    this.client = new Client({ endpoint: `${this.site}/wp-json` });
  }

  apply (compiler) {
    this.util = new SpikeUtil(compiler.options)
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

      const templateContent = this.contentTypes.filter((ct) => {
        return ct.template
      })

      W.map(templateContent, (ct) => {
        return writeTemplate.call(this, ct, compiler, compilation, this.addDataTo, done)
      }).done(() => done(), done)
    })
  }

  run (compiler, compilation, done) {
    return W.reduce(this.contentTypes, (m, ct) => {
      let name
      let options
      let transformFn

      if (typeof ct === 'string') {
        name = ct
        options = {}
        transformFn = true
      } else {
        name = ct.name
        options = ct
        transformFn = ct.transform
      }

      if (typeof transformFn === 'boolean') {
        transformFn = transformFn ? transform : (x) => x
      }

      return W.resolve(this.client.posts(options))
        .then((p) => W.map(p, transformFn))
        .tap((v) => { m[name] = v })
        .yield(m)
    }, {}).done((res) => {
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

/**
 * Validate options
 * @private
 */
function validate (opts = {}) {
  const schema = Joi.object().keys({
    site: Joi.string().required(),
    // apiToken: Joi.string().required(),
    addDataTo: Joi.object().required(),
    json: Joi.string(),
    hooks: Joi.object().keys({
      postTransform: Joi.func()
    }),
    contentTypes: Joi.array().items(
      Joi.string(), Joi.object().keys({
        name: Joi.string(),
        transform: Joi.alternatives().try(Joi.boolean(), Joi.func()).default(true)
      })
    ).default(['posts'])
  })

  const res = Joi.validate(opts, schema, {
    allowUnknown: true,
    language: {
      messages: { wrapArrays: false },
      object: { child: '!![spike-wordpress constructor] option {{reason}}' }
    }
  })
  if (res.error) { throw new Error(res.error) }
  return res.value
}

/**
 * Transform the wordpress response object to make it less messy
 * @private
 */
// function transform (post) {
//   const mapItem = (item) => {
//     console.log(item);
//   mapItem(post)
//   return post
// }

const transform = (post) => {
  let leanPost = {}
  let relevant = ['ID', 'author', 'date', 'modified', 'title', 'URL', 'content', 'excerpt', 'slug', 'status', 'type', 'comment_count', 'featured_image', 'tags', 'categories', 'attachments', '_url', 'post_thumbnail']

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

      case 'post_thumbnail':
        Object.assign(leanPost, {thumbnail: post.post_thumbnail.URL})
        break

      case 'title':
        Object.assign(leanPost, {title: post.title.rendered})
        break

      case 'content':
        Object.assign(leanPost, {content: post.content.rendered})
        break

        case 'excerpt':
          Object.assign(leanPost, {excerpt: post.excerpt.rendered})
          break

      default:
        leanPost[`${prop.toLowerCase()}`] = post[prop]
    }
  })
  return leanPost
}

function writeTemplate (ct, compiler, compilation, addDataTo, cb) {
  const data = addDataTo.wordpress[ct.name]
  const filePath = path.join(compiler.options.context, ct.template.path)

  return node.call(fs.readFile.bind(fs), filePath, 'utf8')
    .then((template) => {
      return W.map(data, (item) => {
        addDataTo = Object.assign(addDataTo, { item: item })
        compiler.resourcePath = filePath

        // webpack context is used by default in spike for plugins, so we need
        // to mock it so that plugins dont crash
        const fakeContext = { addDependency: (x) => x, resourcePath: filePath }
        const options = loader.parseOptions.call(fakeContext, this.util.getSpikeOptions().reshape)

        // W.map fires events as quickly as possible, so the locals will be
        // swapped for the last item unless bound to the result function
        return reshape(options)
          .process(template)
          .then(((locals, res) => {
            const html = res.output(locals)
            compilation.assets[ct.template.output(item)] = {
              source: () => html,
              size: () => html.length
            }
          }).bind(null, Object.assign({}, options.locals)), cb)
      })
    })
}

module.exports = Wordpress
module.exports.transform = transform
