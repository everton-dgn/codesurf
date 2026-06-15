export interface ParsedSseJsonBuffer<T> {
  events: T[]
  errors: Error[]
  remaining: string
}

export function parseSseJsonBuffer<T = unknown>(buffer: string): ParsedSseJsonBuffer<T> {
  const events: T[] = []
  const errors: Error[] = []
  let remaining = buffer
  let boundary = remaining.indexOf('\n\n')

  while (boundary >= 0) {
    const chunk = remaining.slice(0, boundary)
    remaining = remaining.slice(boundary + 2)
    const dataLines = chunk
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())

    if (dataLines.length > 0) {
      try {
        events.push(JSON.parse(dataLines.join('\n')) as T)
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)))
      }
    }

    boundary = remaining.indexOf('\n\n')
  }

  return { events, errors, remaining }
}
