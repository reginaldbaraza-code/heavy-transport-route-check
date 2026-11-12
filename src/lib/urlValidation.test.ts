import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidWebsiteUrl } from './urlValidation'

test('isValidWebsiteUrl allows empty website', () => {
  assert.equal(isValidWebsiteUrl(''), true)
  assert.equal(isValidWebsiteUrl('   '), true)
})

test('isValidWebsiteUrl accepts http(s) URLs', () => {
  assert.equal(isValidWebsiteUrl('https://example.com'), true)
  assert.equal(isValidWebsiteUrl('http://example.com/path'), true)
  assert.equal(isValidWebsiteUrl(' https://acme.example '), true)
})

test('isValidWebsiteUrl rejects invalid website strings', () => {
  assert.equal(isValidWebsiteUrl('notaurl'), false)
  assert.equal(isValidWebsiteUrl('example.com'), false)
  assert.equal(isValidWebsiteUrl('ftp://example.com'), false)
  assert.equal(isValidWebsiteUrl('javascript:alert(1)'), false)
})
