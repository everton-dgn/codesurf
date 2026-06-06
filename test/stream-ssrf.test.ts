import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { assertSafeStreamUrl } from '../src/main/utils/urlSafety.ts'

describe('assertSafeStreamUrl', () => {
  test('blocks private IP 10.0.0.1', () => {
    assert.throws(
      () => assertSafeStreamUrl('http://10.0.0.1/api'),
      /Blocked stream URL: private or reserved IP/
    )
  })

  test('blocks link-local metadata IP 169.254.169.254', () => {
    assert.throws(
      () => assertSafeStreamUrl('https://169.254.169.254/latest/meta-data'),
      /Blocked stream URL: private or reserved IP/
    )
  })

  test('allows public hostname example.com', () => {
    assert.doesNotThrow(() => assertSafeStreamUrl('https://example.com/stream'))
  })

  test('allows public IP 8.8.8.8', () => {
    assert.doesNotThrow(() => assertSafeStreamUrl('http://8.8.8.8/v1/chat'))
  })
})