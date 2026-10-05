import React from 'react'
import { act, create } from 'react-test-renderer'
import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

let mockProfile: { id: string; full_name: string; date_of_birth: string | null } | null = null
jest.mock('../authContext', () => ({ useAuth: () => ({ profile: mockProfile }) }))

// The real UI kit pulls in icon fonts that don't load under Jest; only Button is used.
jest.mock('../../components/ui', () => {
  const { Text } = require('react-native')
  return { Button: ({ title, onPress }: { title: string; onPress: () => void }) => <Text onPress={onPress}>{title}</Text> }
})

import { BirthdayCelebration } from '../../components/birthdayCelebration'

jest.setTimeout(30000) // first render is slow while React Native modules load

const TODAY = new Date(2026, 9, 5, 12) // 5 October 2026

function allText(node: any): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(allText).join('')
  return allText(node.children)
}

async function render() {
  let renderer!: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<BirthdayCelebration />)
  })
  // let the AsyncStorage read resolve
  await act(async () => {
    await Promise.resolve()
  })
  return renderer
}

beforeEach(async () => {
  jest.useFakeTimers({ now: TODAY, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
  await AsyncStorage.clear()
  mockProfile = null
})
afterEach(() => jest.useRealTimers())

describe('BirthdayCelebration', () => {
  it('greets the person by first name with their age on their birthday', async () => {
    mockProfile = { id: 'p1', full_name: 'Tshedza Tshikovhi', date_of_birth: '1990-10-05' }
    const text = allText((await render()).toJSON())
    expect(text).toContain('Happy Birthday, Tshedza!')
    expect(text).toContain('Celebrating 36 years')
  })

  it('renders nothing on any other day', async () => {
    mockProfile = { id: 'p1', full_name: 'Tshedza Tshikovhi', date_of_birth: '1990-10-06' }
    expect((await render()).toJSON()).toBeNull()
  })

  it('renders nothing without a date of birth or without a profile', async () => {
    mockProfile = { id: 'p1', full_name: 'No Dob', date_of_birth: null }
    expect((await render()).toJSON()).toBeNull()
    mockProfile = null
    expect((await render()).toJSON()).toBeNull()
  })

  it('does not show again the same day once it has been dismissed', async () => {
    mockProfile = { id: 'p1', full_name: 'Tshedza Tshikovhi', date_of_birth: '1990-10-05' }
    await AsyncStorage.setItem('birthday-shown:p1:2026-10-05', '1')
    expect((await render()).toJSON()).toBeNull()
  })

  it('remembers dismissal when the button is pressed', async () => {
    mockProfile = { id: 'p1', full_name: 'Tshedza Tshikovhi', date_of_birth: '1990-10-05' }
    const renderer = await render()
    const buttons = renderer.root.findAll((n) => typeof n.props.onPress === 'function')
    expect(buttons.length).toBeGreaterThan(0)
    await act(async () => {
      buttons[0].props.onPress()
      await Promise.resolve()
    })
    expect(await AsyncStorage.getItem('birthday-shown:p1:2026-10-05')).toBe('1')
    expect((await render()).toJSON()).toBeNull()
  })

  it('shows again the next year (new day key)', async () => {
    mockProfile = { id: 'p1', full_name: 'Tshedza Tshikovhi', date_of_birth: '1990-10-05' }
    await AsyncStorage.setItem('birthday-shown:p1:2025-10-05', '1')
    expect(allText((await render()).toJSON())).toContain('Happy Birthday')
  })
})
