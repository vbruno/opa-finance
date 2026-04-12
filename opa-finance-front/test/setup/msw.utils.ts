import { HttpResponse, delay } from 'msw'

type ErrorBody = {
  message: string
}

type PaginationParams = {
  page: number
  limit: number
}

type PaginatedResponse<T> = {
  data: T[]
  page: number
  limit: number
  total: number
}

export function ok<T>(body: T, init?: ResponseInit) {
  return HttpResponse.json(body, init)
}

export function created<T>(body: T, init?: ResponseInit) {
  return HttpResponse.json(body, { status: 201, ...init })
}

export function noContent(init?: ResponseInit) {
  return new HttpResponse(null, { status: 204, ...init })
}

export function badRequest(message: string, init?: ResponseInit) {
  return HttpResponse.json<ErrorBody>({ message }, { status: 400, ...init })
}

export function unauthorized(message = 'Não autorizado.', init?: ResponseInit) {
  return HttpResponse.json<ErrorBody>({ message }, { status: 401, ...init })
}

export function notFound(message = 'Recurso não encontrado.', init?: ResponseInit) {
  return HttpResponse.json<ErrorBody>({ message }, { status: 404, ...init })
}

export function serverError(
  message = 'Erro interno do servidor.',
  init?: ResponseInit,
) {
  return HttpResponse.json<ErrorBody>({ message }, { status: 500, ...init })
}

export function paginated<T>(
  items: T[],
  params: PaginationParams,
): PaginatedResponse<T> {
  const total = items.length
  const offset = (params.page - 1) * params.limit
  return {
    data: items.slice(offset, offset + params.limit),
    page: params.page,
    limit: params.limit,
    total,
  }
}

export function parsePaginationFromUrl(urlString: string): PaginationParams {
  const url = new URL(urlString)
  const page = Number(url.searchParams.get('page') ?? '1')
  const limit = Number(url.searchParams.get('limit') ?? '30')

  return {
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 30,
  }
}

export async function withDelay(ms = 0) {
  await delay(ms)
}
