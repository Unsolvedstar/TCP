import React from 'react'
import { act, create } from 'react-test-renderer'

// Same stubs as button.test.tsx — ui.tsx pulls these in and none load under Jest.
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }))
jest.mock('expo-clipboard', () => ({}))
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: {} }))
jest.mock('../alert', () => ({ Alert: { alert: jest.fn() } }))

import { CertificatePaper } from '../../components/certificatePaper'
import { DEFAULT_VERSES } from '../certificateVerse'
import type { CeremonyKind, LeagueRow } from '../types'

jest.setTimeout(30000)

const league = {
  id: 'l1',
  key: 'PrayerYouth',
  label: 'Prayer Youth League',
  verse_text: 'Do not conform to the pattern of this world.',
  verse_reference: 'Romans 12:2 NIV',
  chairperson_name: 'A. Chair',
  pastor_name: 'B. Pastor',
} as unknown as LeagueRow

const baptism = {
  type: 'infant',
  sponsor_name: 'Self',
  submitted_at: '2026-01-01',
  location: 'Tshwane City',
  officiant_name: 'Rev. Officiant',
  register_no: '01/02/03',
  diocese: 'Central Diocese',
  parents: 'Parent One & Parent Two',
  birth_place: 'Pretoria',
}

// All visible text on the sheet, flattened to one string so split text nodes read naturally.
function flat(node: unknown): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(flat).join('')
  return flat((node as { children?: unknown }).children)
}

// Every string the sheet renders, in order.
function texts(node: ReturnType<typeof create>): string {
  return JSON.stringify(node.toJSON())
}

async function render(el: React.ReactElement) {
  let tree!: ReturnType<typeof create>
  await act(async () => {
    tree = create(el)
  })
  return tree
}

describe('CertificatePaper', () => {
  it('renders a baptism certificate with the person, details and sponsors', async () => {
    const out = texts(
      await render(
        <CertificatePaper kind="baptism" name="Test Person" displayDate="2026-07-26" dateOfBirth="2007-08-31" application={baptism as never} parishName="ELCSA Test Parish" />,
      ),
    )
    expect(out).toContain('Test Person')
    expect(out).toContain('Baptismal Certificate')
    expect(out).toContain('Register No')
    expect(out).toContain('01/02/03')
    expect(out).toContain('Sponsors')
    expect(out).toContain('ELCSA Test Parish')
  })

  it('leaves out detail rows that have no value instead of printing empty labels', async () => {
    const out = texts(await render(<CertificatePaper kind="baptism" name="Test Person" displayDate={null} application={{ ...baptism, diocese: null, parents: '  ' } as never} />))
    expect(out).not.toContain('Diocese')
    expect(out).not.toContain('Parents')
  })

  it('renders a league certificate with the league, verse and both signatories', async () => {
    const out = texts(await render(<CertificatePaper kind="league" name="Test Person" displayDate="2026-07-26" league={league} parishName="ELCSA Test Parish" parishAddress="1 Test St" />))
    expect(out).toContain('Prayer Youth League')
    expect(out).toContain('Romans 12:2 NIV')
    expect(out).toContain('A. Chair')
    expect(out).toContain('B. Pastor')
    expect(out).toContain('1 Test St')
  })

  it('renders a confirmation certificate with the supplied detail line', async () => {
    const out = texts(await render(<CertificatePaper kind="confirmation" name="Test Person" displayDate="2026-07-26" detail="Mentor: Someone" />))
    expect(out).toContain('Certificate of Confirmation')
    expect(out).toContain('Mentor: Someone')
  })

  it('falls back to the default parish name when none is given', async () => {
    const out = texts(await render(<CertificatePaper kind="confirmation" name="Test Person" displayDate={null} />))
    expect(out).toContain('ELCSA Tshwane City Parish')
  })

  describe('Bible verse', () => {
    const KINDS: CeremonyKind[] = ['baptism', 'confirmation', 'league']
    const bare = (kind: CeremonyKind) => (
      <CertificatePaper kind={kind} name="Test Person" displayDate="2026-07-26" application={kind === 'baptism' ? ({ ...baptism } as never) : undefined} league={kind === 'league' ? ({ ...league, verse_text: null, verse_reference: null } as LeagueRow) : undefined} />
    )

    it.each(KINDS)('%s certificate always shows a verse, falling back to the default when none is set', async (kind) => {
      const text = flat((await render(bare(kind))).toJSON())
      expect(text).toContain(DEFAULT_VERSES[kind].reference)
      expect(text).toContain(DEFAULT_VERSES[kind].text.slice(0, 30))
    })

    it('prefers the verse an admin set over the default', async () => {
      const text = flat((await render(<CertificatePaper kind="baptism" name="T" displayDate={null} application={{ ...baptism, verse_text: 'Custom words.', verse_reference: 'Psalm 1:1' } as never} />)).toJSON())
      expect(text).toContain('Custom words')
      expect(text).toContain('Psalm 1:1')
      expect(text).not.toContain(DEFAULT_VERSES.baptism.reference)
    })

    it('does not double the full stop around a baptism verse', async () => {
      const text = flat((await render(bare('baptism'))).toJSON())
      expect(text).not.toContain('.”.')
      expect(text).toContain('put on Christ”. Galatians 3:27 WEB')
    })
  })
})
