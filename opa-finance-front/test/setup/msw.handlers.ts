import { http } from 'msw'

import { ok } from './msw.utils'

export const handlers = [
  // Health/default mock to validate base MSW wiring.
  http.get('*/health', () => ok({ status: 'ok' })),
]
