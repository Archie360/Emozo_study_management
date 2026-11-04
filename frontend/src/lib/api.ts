const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Backend error shape: { error: { code, message, fields } } — see
    // backend/src/utils/errors.ts and middleware/errorHandler.ts.
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.message ?? "Request failed.", err.fields);
  }

  return body as T;
}

// Separate from `request`: a file upload needs the browser to set its own
// multipart/form-data boundary on Content-Type, so the header can't be
// forced to application/json like every other call does.
async function requestUpload<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(res.status, err.message ?? "Request failed.", err.fields);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, file: File) => requestUpload<T>(path, file),
};

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export { toQuery };
