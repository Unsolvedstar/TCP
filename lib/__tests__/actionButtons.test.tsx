import React from 'react'
import { act, create } from 'react-test-renderer'

const mockAlert = jest.fn()
jest.mock('../alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }))
jest.mock('expo-clipboard', () => ({}))
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: {} }))

import { ActionButton, ChipButton, OptionButton, TabButton } from '../../components/ui'

jest.setTimeout(30000)
type Tree = ReturnType<typeof create>

async function render(el: React.ReactElement): Promise<Tree> {
  let tree!: Tree
  await act(async () => {
    tree = create(el)
  })
  return tree
}

// The Pressable host node: the one carrying an accessibility role.
function button(tree: Tree) {
  const nodes = tree.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')
  return nodes[nodes.length - 1]
}

describe('button components expose real button semantics', () => {
  it.each([
    ['ActionButton', <ActionButton key="a" label="Remove" onPress={() => {}} />, 'Remove'],
    ['TabButton', <TabButton key="t" label="Leagues" active={false} onPress={() => {}} />, 'Leagues'],
    ['ChipButton', <ChipButton key="c" label="Logins" active={false} onPress={() => {}} />, 'Logins'],
    ['OptionButton', <OptionButton key="o" label="Youth League" selected={false} onPress={() => {}} />, 'Youth League'],
  ])('%s has role=button and an accessible name', async (_n, el, name) => {
    const b = button(await render(el))
    expect(b.props.accessibilityRole).toBe('button')
    expect(b.props.accessibilityLabel).toBe(name)
  })

  it('reports selected state for tabs and options', async () => {
    expect(button(await render(<TabButton label="A" active onPress={() => {}} />)).props.accessibilityState).toEqual({ selected: true })
    expect(button(await render(<OptionButton label="A" selected={false} onPress={() => {}} />)).props.accessibilityState).toEqual({ selected: false })
  })
})

describe('ActionButton behaviour', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn()
    const tree = await render(<ActionButton label="Approve" tone="primary" onPress={onPress} />)
    await act(async () => {
      await button(tree).props.onPress()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('ignores a second tap while the first handler is still running', async () => {
    let release!: () => void
    const onPress = jest.fn(() => new Promise<void>((r) => (release = r)))
    const tree = await render(<ActionButton label="Save" onPress={onPress} />)
    await act(async () => {
      button(tree).props.onPress()
      button(tree).props.onPress()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
    await act(async () => release())
  })

  it('turns a failing handler into an alert instead of an unhandled rejection', async () => {
    const tree = await render(<ActionButton label="Delete" tone="danger" onPress={() => Promise.reject(new Error('nope'))} />)
    jest.spyOn(console, 'error').mockImplementation(() => {})
    await act(async () => {
      await button(tree).props.onPress()
    })
    expect(mockAlert).toHaveBeenCalledWith('Something went wrong', 'nope')
  })

  it('is disabled when asked', async () => {
    const tree = await render(<ActionButton label="Save" disabled onPress={() => {}} />)
    expect(button(tree).props.disabled).toBe(true)
    expect(button(tree).props.accessibilityState).toEqual({ disabled: true })
  })
})
