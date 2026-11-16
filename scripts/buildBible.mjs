// Builds assets/bible/kjv.json (King James Version, 1769 text — public domain)
// from scrollmapper/bible_databases' formats/json/KJV.json.
//
//   node scripts/buildBible.mjs <path-to-KJV.json>
//
// Output shape: { "Genesis": [ ["v1 text", "v2 text", ...], ...chapters ], ... }
// i.e. books in canonical order, chapters as arrays, verse N at index N-1.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const src = process.argv[2]
if (!src) throw new Error('usage: node scripts/buildBible.mjs <path-to-KJV.json>')

// The source names books with roman numerals and "Revelation of John".
const rename = (name) => name.replace(/^III /, '3 ').replace(/^II /, '2 ').replace(/^I /, '1 ').replace(/^Revelation of John$/, 'Revelation')

// In the KJV source, a psalm's superscription ("A Psalm of David.", "To the chief
// Musician upon Gittith, A Psalm of David.") is merged into the front of verse 1.
// Certificates quote the verse, not the title, so strip it.
const TITLE_START = /^(A |To the chief|Maschil|Michtam|Shiggaion|David’s|\w+ of )/
const TITLE_WORDS = /Psalm|Song|Maschil|Michtam|Shiggaion|Prayer|Musician|Korah|David|Asaph|Moses|degrees|Jeduthun|Solomon/
function stripPsalmTitle(text) {
  if (!TITLE_START.test(text)) return { text, stripped: null }
  // Title ends at the first full stop — except Psalm 18, whose title runs "...of Saul: And he said, I will love thee".
  const m = text.match(/^(.*?(?:Saul:\s+And he said,|[.?!]))\s+(\S.*)$/s)
  if (!m || !TITLE_WORDS.test(m[1])) return { text, stripped: null }
  return { text: m[2], stripped: m[1] }
}

const data = JSON.parse(readFileSync(src, 'utf8'))
const out = {}
let verses = 0
const strippedTitles = []
for (const book of data.books) {
  const name = rename(book.name)
  out[name] = book.chapters.map((c) => {
    const row = []
    for (const v of c.verses) {
      // Psalm 119's acrostic section headings ("א ALEPH.") are merged into the verse too.
      let text = v.text.replace(/\s+/g, ' ').trim().replace(/^[֐-׿]+\s+[A-Z]+\.\s+/, '')
      if (name === 'Psalms' && v.verse === 1) {
        const r = stripPsalmTitle(text)
        if (r.stripped) strippedTitles.push(`Ps ${c.chapter}: ${r.stripped}  ||  ${r.text.slice(0, 40)}`)
        text = r.text
      }
      row[v.verse - 1] = text
      verses++
    }
    return Array.from(row, (t) => t ?? '')
  })
}

const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'bible', 'kjv.json')
mkdirSync(dirname(dest), { recursive: true })
writeFileSync(dest, JSON.stringify(out))
console.log(`wrote ${dest}: ${Object.keys(out).length} books, ${verses} verses, ${strippedTitles.length} psalm titles stripped`)
if (process.env.SHOW_TITLES) console.log(strippedTitles.join('\n'))
