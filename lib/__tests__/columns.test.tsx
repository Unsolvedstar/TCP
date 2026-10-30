import React from 'react'
import { Text } from 'react-native'
import { act, create } from 'react-test-renderer'

let mockWide = false
jest.mock('../layout', () => ({ ...jest.requireActual('../layout'), useIsWide: () => mockWide }))

import { Columns } from '../../components/columns'

jest.setTimeout(30000)

async function render(wide: boolean) {
  mockWide = wide
  let tree!: ReturnType<typeof create>
  await act(async () => {
    tree = create(<Columns left={<Text>LEFT</Text>} right={<Text>RIGHT</Text>} />)
  })
  return tree
}

describe('Columns', () => {
  it('lays the two sides out in a row on wide screens', async () => {
    const tree = await render(true)
    const row = tree.root.findAll((n) => n.props.style && (Array.isArray(n.props.style) ? false : n.props.style.flexDirection === 'row'))
    expect(row.length).toBeGreaterThan(0)
  })

  it('stacks left then right with no wrapper row on narrow screens', async () => {
    const tree = await render(false)
    const json = JSON.stringify(tree.toJSON())
    expect(json.indexOf('LEFT')).toBeGreaterThan(-1)
    expect(json.indexOf('LEFT')).toBeLessThan(json.indexOf('RIGHT'))
    expect(json).not.toContain('"flexDirection":"row"')
  })
})
