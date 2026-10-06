const mockAlert = jest.fn()
jest.mock('../alert', () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) } }))

import { rpcAction } from '../rpcAction'

beforeEach(() => mockAlert.mockClear())

describe('rpcAction', () => {
  it('runs onSuccess and returns true when the call succeeds', async () => {
    const onSuccess = jest.fn()
    expect(await rpcAction(async () => ({ error: null }), 'Nope', onSuccess)).toBe(true)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(mockAlert).not.toHaveBeenCalled()
  })

  it('alerts with the server message and skips onSuccess on an error result', async () => {
    const onSuccess = jest.fn()
    expect(await rpcAction(async () => ({ error: { message: 'denied' } }), 'Could not remove', onSuccess)).toBe(false)
    expect(mockAlert).toHaveBeenCalledWith('Could not remove', 'denied')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('turns a rejected call into an alert instead of throwing', async () => {
    expect(await rpcAction(() => Promise.reject(new Error('offline')), 'Could not remove')).toBe(false)
    expect(mockAlert).toHaveBeenCalledWith('Could not remove', 'offline')
  })
})
