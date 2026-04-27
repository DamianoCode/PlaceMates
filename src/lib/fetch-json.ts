/**
 * `fetch` + JSON wrapper that throws on non-2xx. The thrown error
 * carries `status`, which `QueryProvider`'s retry policy reads to
 * skip retries on 4xx. For 404 we throw a sentinel that callers can
 * catch via `placeholderData` rather than treating it as a hard error.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new HttpError(res.status, `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
