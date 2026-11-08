import { isAxiosError } from 'axios'

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) return fallback
  const data: unknown = error.response?.data
  if (typeof data !== 'object' || data === null) return fallback
  if ('errors' in data && typeof data.errors === 'object' && data.errors !== null) {
    const firstError = Object.values(data.errors).flatMap((value) =>
      Array.isArray(value) ? value : [value]
    ).find((value): value is string => typeof value === 'string')
    if (firstError) return firstError
  }
  return 'message' in data && typeof data.message === 'string' ? data.message : fallback
}
