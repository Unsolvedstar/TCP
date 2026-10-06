import React from 'react'
import { act, create } from 'react-test-renderer'

const mockAlert = jest.fn()
jest.mock('../alert', () => ({ Alert: { alert: (...args: unknown[]) => mockAlert(...args) } }))
// Icon fonts / gradients don't load under Jest and Button doesn't use them.
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }))
jest.mock('expo-clipboard', () => ({}))
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null, DateTimePickerAndroid: {} }))

import { Button } from '../../components/ui'

jest.setTimeout(30000)

type Tree = ReturnType<typeof create>

async function render(onPress: () => void | Promise<unknown>): Promise<Tree> {
  let tree!: Tree
  await act(async () => {
    tree = create(<Button title="Pay" onPress={onPress} />)
  })
  return tree
}

function press(tree: Tree) {
  return act(async () => {
    // findAll is outermost-first: [0] is <Button> itself (raw handler); the
    // last match is the Pressable wired to Button's guarded handlePress.
    const nodes = tree.root.findAll((n) => typeof n.props.onPress === 'function')
    nodes[nodes.length - 1].props.onPress()
  })
}

describe('Button', () => {
  beforeEach(() => {
    mockAlert.mockClear()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('ignores re-taps while an async handler is running', async () => {
    let release!: () => void
    const onPress = jest.fn(() => new Promise<void>((r) => (release = r)))
    const tree = await render(onPress)
    await press(tree)
    await press(tree)
    expect(onPress).toHaveBeenCalledTimes(1)
    await act(async () => release())
    await press(tree)
    expect(onPress).toHaveBeenCalledTimes(2)
  })

  it('turns a rejected handler into an alert instead of an unhandled rejection', async () => {
    const tree = await render(() => Promise.reject(new Error('boom')))
    await press(tree)
    expect(mockAlert).toHaveBeenCalledWith('Something went wrong', 'boom')
  })

  it('also survives a synchronous throw', async () => {
    const tree = await render(() => { throw new Error('sync') })
    await press(tree)
    expect(mockAlert).toHaveBeenCalledWith('Something went wrong', 'sync')
  })
})
