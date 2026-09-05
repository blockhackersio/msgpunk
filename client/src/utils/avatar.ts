import { blake3 } from '@noble/hashes/blake3'
import { bytesToHex } from '@noble/hashes/utils'
import { createAvatar } from '@dicebear/core'
import * as notionists from '@dicebear/notionists'
import { BIP39_WORDS } from './bip39'

const DOMAIN_SEPARATOR = 'msgpunk/sigil/v1'

function deriveHash(ageKey: string): Uint8Array {
  const input = new TextEncoder().encode(DOMAIN_SEPARATOR + ageKey)
  return blake3(input)
}

function hashToWords(hash: Uint8Array): [string, string, string] {
  const view = new DataView(hash.buffer, hash.byteOffset, hash.byteLength)
  const a = view.getUint32(0, true)
  const b = view.getUint32(4, true)
  const c = view.getUint32(8, true)

  const word1 = BIP39_WORDS[a % BIP39_WORDS.length]
  const word2 = BIP39_WORDS[b % BIP39_WORDS.length]
  const word3 = BIP39_WORDS[c % BIP39_WORDS.length]

  return [word1, word2, word3]
}

export interface AvatarData {
  svg: string
  slug: string
  hex: string
}

export function generateAvatar(ageKey: string): AvatarData {
  const hash = deriveHash(ageKey)
  const hex = bytesToHex(hash)
  const words = hashToWords(hash)
  const slug = words.join('-')

  const avatar = createAvatar(notionists, {
    seed: hex,
  })

  return { svg: avatar.toString(), slug, hex }
}
