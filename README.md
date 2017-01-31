spike wordpress
================

[![Greenkeeper badge](https://badges.greenkeeper.io/wkentdag/spike-wordpress.svg)](https://greenkeeper.io/)

[![npm](https://img.shields.io/npm/v/spike-wordpress.svg?style=flat)](https://www.npmjs.com/package/spike-wordpress) [![tests](https://img.shields.io/travis/wkentdag/spike-wordpress/master.svg?style=flat)](https://travis-ci.org/wkentdag/spike-wordpress) [![dependencies](https://david-dm.org/wkentdag/spike-wordpress.svg)](https://david-dm.org/wkentdag/spike-wordpress) [![Coverage Status](https://img.shields.io/coveralls/wkentdag/spike-wordpress.svg?style=flat)](https://coveralls.io/r/wkentdag/spike-wordpress?branch=master)

use wordpress as a backend for your [spike](https://www.spike.cf/) static project

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

> check out [this video](https://www.youtube.com/watch?v=gdWZ0Bpvmw4) demonstrating how you can easily set up a wordpress-powered static site that recompiles whenever you publish a new post or push to github using  [roots-wordpress](https://github.com/carrot/roots-wordpress), which this project is based on :eyes:

### usage
add the plugin to your `app.js` file...

```js
//  app.js

const wordpress = require('spike-wordpress')
const standard = require('reshape-standard')
const locals = {}

module.exports = {
  plugins: [
    new Wordpress({
      site: 'my_wordpress_site.com',
      addDataTo: locals
    })
  ],
  reshape: (ctx) => {
    return standard({
      webpack: ctx,
      locals
    })
  }
  // ...other config...
}
```

...and then access your posts as local variables in your view files:

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
- [x] [filter results with query params](#filter-results-with-query-params)
- [x] [transform function](#transform-function)
- [x] [render posts to a view template](#render-posts-to-a-template)
- [x] [save output to json](#save-output-to-json)
- [x] [`postTransform` hook](#posttransform-hook)

**PRs welcome for new features!**

#### filter results with query params

by default the plugin dumps  all your posts into a single `wordpress.posts` array in the view locals, but you can use the `posts` option to make multiple queries. pass in an array of config objects with a `name` (required, so that you can access it in your locals at `wordpress[name]`) and any parameter supported by the [wordpress api](https://developer.wordpress.com/docs/api/1/get/sites/%24site/posts/):

```js
const locals = {}
new Wordpress({
  name: 'my_wordpress_site',
  addDataTo: locals,
  posts: [
    {
      name: 'posts'
      number: '10'  //  default limit is 20, max is 100
    },
    {
      name: 'interviews',
      category: 'interview',
      order: 'ASC',
      search: 'some text'
    }
  ]
})

```

#### transform function

you can also include an arbitrary `transform` function to apply to posts on the fly during the build process (see [postTransform hook](#posttransform-hooks) if you want to manipulate your locals after they've already been processed):

```js
new Wordpress({
  name: 'my_wordpress_site',
  addDataTo: locals,
  posts: [{
    name: 'funtimes',
    transform: (post) => {
      post.foo = 'bar'
      return post
    }
  }]
})
```

posts are run through a generic transform function by default; you can pass `transform: false` to bypass it and return the raw result

#### render posts to a template

you can add an optional `template` param that will render each item in `posts[param]`
to a specific view template with a configurable output path:

```js
const locals = {}
new Wordpress({
  name: 'my_wordpress_site',
  addDataTo: locals,
  posts: [{
    name: 'portfolio',
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


#### save output to json

pass a file name to the `json` param to write the `locals.wordpress` output to:

```js
const locals = {}
new Wordpress({
  name: 'my_wordpress_site',
  addDataTo: locals,
  json: 'data.json'
})

```


#### postTransform hook

add a `postTransform` hook to modify posts and locals before
your templates get compiled, but *after* each `post`'s (optional) `transform` function runs:

```js
const fs = require('fs')
const locals = {}
new Wordpress({
  name: 'my_wordpress_site',
  addDataTo: locals,
  posts: [{
    name: 'posts',
    transform: (post) => {  // this runs first...
      return post.title
    }
  }],
  hooks: {
    postTransform: (posts, locals) => {
      posts.map(p => p.toUpperCase())
      return [posts, locals] //  posts = ['TITLE1', 'TITLE 2', etc]
    }
  }
})
```

### testing

The tests depend on a jetpack-enabled test wordpress instance.
If you are developing a new feature and want to run the test suite either submit a PR (they'll be auto run by travis), or file an issue and I'll get you access to the test server :)

```sh
# install module dependencies
npm i

# create a config file from the boilerplate
mv .env.sample .env

# run the tests
npm test
```
