/**
 * The access token lives in memory only (requirement AUTH-02), like in the game: a page reload needs a new login.
 * It is deliberately not written to localStorage or sessionStorage.
 */
let token: string | null = null
let unauthorizedHandler: (() => void) | null = null

export function getToken(): string | null {
  return token
}

export function setToken(value: string | null): void {
  token = value
}

/** Registers the function that is called when the server rejects the token (expired or invalid). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.()
}
