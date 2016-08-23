spike wordpress
================

[![npm](https://img.shields.io/npm/v/spike-wordpress.svg?style=flat)](http://badge.fury.io/js/spike-wordpress) [![tests](https://img.shields.io/travis/wkentdag/spike-wordpress/master.svg?style=flat)](https://travis-ci.org/wkentdag/spike-wordpress) [![dependencies](https://img.shields.io/gemnasium/wkentdag/spike-wordpress.svg?style=flat)](https://gemnasium.com/wkentdag/spike-wordpress) [![Coverage Status](https://img.shields.io/coveralls/wkentdag/spike-wordpress.svg?style=flat)](https://coveralls.io/r/wkentdag/spike-wordpress?branch=master)

pull wordpress posts into your [spike](https://github.com/static-dev/spike) static project

### installation
```
npm i -S spike-wordpress
```

### setup

- create a wordpress site (self-hosted or on wordpress.com)
  - check the 1click wordpress app on [digital ocean](https://m.do.co/c/6e3837272e2f) for a quick cheap self-hosted option
- install and activate wordpress [jetpack](https://wordpress.org/plugins/jetpack/) plugin
- make sure the "JSON API" feature is turned on within jetpack
- :beers: 

### usage

```js
//  app.js
const wordpress = require('spike-wordpress')
const htmlStandards = require('spike-html-standards')
const locals = {}

module.exports = {
  plugins: [
    new Wordpress({
      addDataTo: locals, name: 'my_wordpress_site'
    })
  ],
  reshape: (ctx) => {
    return htmlStandards({
      locals: { locals }
    })
  }
}

```
