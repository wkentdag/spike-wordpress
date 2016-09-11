spike wordpress
================

[![npm](https://img.shields.io/npm/v/spike-wordpress.svg?style=flat)](http://badge.fury.io/js/spike-wordpress) [![tests](https://img.shields.io/travis/wkentdag/spike-wordpress/master.svg?style=flat)](https://travis-ci.org/wkentdag/spike-wordpress) [![dependencies](https://david-dm.org/wkentdag/pow.svg)](https://david-dm.org/wkentdag/pow) [![Coverage Status](https://img.shields.io/coveralls/wkentdag/spike-wordpress.svg?style=flat)](https://coveralls.io/r/wkentdag/spike-wordpress?branch=master)

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
          h3 by {{ post.author }} on {{ post.date }}
```

### features

more of a roadmap at the moment...

- [x] pass posts to locals
- [ ] fetch and sort multiple `contentTypes` [in progress]
- [ ] write to view template
  - [ ] basic
  - [ ] customize slug
- [ ] query each `contentType`
  - [ ] order
  - [ ] search
  - [ ] limit
  - [ ] transform
- [ ] hooks
  - [ ] post transform
- [ ] cache `wordpress` locals object as json

### testing

```sh
# install module dependencies
npm i

# create a config file from the boilerplate (overwrite with your site info)
mv .env.sample .env

# run the tests
npm test
```
