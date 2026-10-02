export function apiFetch(input, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = sessionStorage.getItem('authToken')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...options, headers })
}
