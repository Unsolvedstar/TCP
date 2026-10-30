import { getQueryParams } from '../queryParams'

describe('getQueryParams', () => {
  it('reads tokens from the #fragment of a reset link', () => {
    const { params, errorCode } = getQueryParams('elcsatcp://resetPassword#access_token=abc&refresh_token=def&type=recovery')
    expect(params).toEqual({ access_token: 'abc', refresh_token: 'def', type: 'recovery' })
    expect(errorCode).toBeNull()
  })

  it('reads tokens from the query string', () => {
    const { params } = getQueryParams('https://example.com/resetPassword?access_token=abc&refresh_token=def')
    expect(params.access_token).toBe('abc')
    expect(params.refresh_token).toBe('def')
  })

  it('lets the fragment win over the query when both define a key', () => {
    const { params } = getQueryParams('elcsatcp://resetPassword?access_token=old#access_token=new')
    expect(params.access_token).toBe('new')
  })

  it('splits errorCode out of the params', () => {
    const { params, errorCode } = getQueryParams('elcsatcp://resetPassword?errorCode=otp_expired&foo=bar')
    expect(errorCode).toBe('otp_expired')
    expect(params).toEqual({ foo: 'bar' })
  })

  it('does not throw on a link with no params', () => {
    expect(getQueryParams('elcsatcp://resetPassword')).toEqual({ errorCode: null, params: {} })
  })
})
