spike wordpress
================

[![npm](https://img.shields.io/npm/v/spike-wordpress.svg?style=flat)](https://www.npmjs.com/package/spike-wordpress) [![tests](https://img.shields.io/travis/wkentdag/spike-wordpress/master.svg?style=flat)](https://travis-ci.org/wkentdag/spike-wordpress) [![dependencies](https://david-dm.org/wkentdag/pow.svg)](https://david-dm.org/wkentdag/pow) [![Coverage Status](https://img.shields.io/coveralls/wkentdag/spike-wordpress.svg?style=flat)](https://coveralls.io/r/wkentdag/spike-wordpress?branch=master)

pull wordpress posts into your [spike](https://www.spike.cf/) static project

> ported from [`static-dev/spike-rooftop`](https://github.com/static-dev/spike-rooftop) - check that out if you're using rooftop CMS

### installation
```sh
npm i -S spike-wordpress
```

### setup

- create a wordpress site (self-hosted or on wordpress.com)
  - check the 1click wordpress app on [digital ocean](https://m.do.co/c/6e3837272e2f) for a quick cheap self-hosted option
- install and activate wordpress [jetpack](https://wordpress.org/plugins/jetpack/) plugin
- make sure the "JSON API" feature is turned on within jetpack
- :beers:

### usage
add the plugin to your `app.js` file:

```js
//  app.js

const wordpress = require('spike-wordpress')
const standard = require('reshape-standard')
const locals = {}

module.exports = {
  plugins: [
    new Wordpress({
      name: 'my_wordpress_site',
      addDataTo: locals,
    })
  ],
  reshape: (ctx) => {
    return standard({
      webpack: ctx,
      locals: { locals }
    })
  }
  // ...other config...
}
```

access your posts as local variables in your view files:

```jade
//  some_template.sgr

extends(src='layout.sgr')
  block(name='content')
    h1 My awesome static blog

    h2 Recent posts
    .recent
      each(loop='post, i in wordpress.posts')
        if(condition='i < 10')
          h1 {{ post.title }}
          h2 {{ post.excerpt }}
          h3 by {{ post.author.name }} on {{ post.date }}
```

### features


- [x] pass posts to locals
- [x] [fetch and sort multiple `postTypes`](#select-posts-by-type)
- [x] [apply query params per `postType`](#apply-query-params-per-postType)
- [x] [render posts to a specific view template](#render-posts-to-a-template)
- [ ] hooks
  - [ ] post transform
- [ ] cache `wordpress` locals object as json

#### select posts by type

by default the plugin returns all posts into the local variable `wordpress.posts`,
but you can also select multiple types of posts according to their `category` on wordpress.
simply pass an array of categories when you initialize the plugin, and then
access them in your views with `wordpress[category]`:

```js
const locals = {}
new Wordpress({
  name: 'my_wordpress_site',
  addDataTo: locals,
  postTypes: ['interview', 'review']
})

```

#### apply query params per type

to apply a set of query parameters to an array of `postTypes`, pass in a config object instead of a string:

```js
const locals = {}
new Wordpress({
  name: 'my_wordpress_site',
  addDataTo: locals,
  postTypes: [{
    category: 'funtimes',
    search: 'text',
    order: 'ASC',
    number: '10'  //  default limit is 20, max is 100
    transform: (post) => {  // uses a generic transform function by default. also pass `false` to get the raw result
      post.foo = 'bar'
      return post
    }
  }]
})

```

#### render posts to a template

you can add an optional `template` param that will render each item in `postTypes[param]`
to a specific view template with a configurable output path:

```js
const locals = {}
new Wordpress({
  name: 'my_wordpress_site',
  addDataTo: locals,
  postTypes: [{
    category: 'portfolio',
    template: {
      path: 'views/portfolio-item.sgr',
      output: (item) => `posts/${item.slug}.html`
    }

  }]
})
```

```jade
//  portfolio-item.sgr

h1 {{ item.title }}
img(src={{ item.featured_image }})
p {{ item.content }}
```

### testing

```sh
# install module dependencies
npm i

# create a config file from the boilerplate (overwrite with your site info)
mv .env.sample .env

# run the tests
npm test
```
