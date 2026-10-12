import assert from 'node:assert/strict'
import { scegliFileVideo } from './scegliFileVideo.mjs'

const link = (w) => `https://player.vimeo.com/external/${w}.mp4`

const scelto = scegliFileVideo([
  { file_type: 'video/mp4', width: 2160, height: 3840, link: link(2160) },
  { file_type: 'video/mp4', width: 720, height: 1280, link: link(720) },
  { file_type: 'video/mp4', width: 1080, height: 1920, link: link(1080) },
  { file_type: 'video/mp4', width: null, height: null, link: 'https://player.vimeo.com/x.m3u8' }
])
assert.equal(scelto.width, 1080)

const senzaVerticale = scegliFileVideo([
  { file_type: 'video/mp4', width: 3840, height: 2160, link: link('4k') },
  { file_type: 'video/mp4', width: 1280, height: 720, link: link(1280) },
  { file_type: 'video/mp4', width: 1920, height: 1080, link: link(1920) }
])
assert.equal(senzaVerticale.width, 1280)

const niente = scegliFileVideo([
  { file_type: 'video/mp4', width: 3840, height: 2160, link: link('4k') }
])
assert.equal(niente, null)

console.log('scegliFileVideo ok')
