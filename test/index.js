require('dotenv').config({ silent: true })

const test = require('ava')
const Wordpress = require('..')
const Spike = require('spike-core')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const htmlStandards = require('spike-html-standards')

const compilerMock = { options: { spike: { locals: {} } } }
const NAME = process.env.NAME

test('errors without a "name"', (t) => {
  t.throws(
    () => { new Wordpress() }, // eslint-disable-line
    'ValidationError: [spike-wordpress constructor] option "name" is required'
  )
})

test('errors without "addDataTo"', (t) => {
  t.throws(
    () => { new Wordpress({ name: NAME}) }, // eslint-disable-line
    'ValidationError: [spike-wordpress constructor] option "addDataTo" is required'
  )
})

test('initializes with a name and addDataTo', (t) => {
  const wp = new Wordpress({ name: NAME, addDataTo: {} })
  t.truthy(wp)
})
