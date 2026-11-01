import { z } from 'zod';

export const PACKAGE_NAME = '@ventidoc/validation';

export const placeholderSchema = z.object({
  message: z.string().min(1),
});

export function placeholder(): string {
  return `${PACKAGE_NAME} placeholder — Zod schemas exported to OpenAPI land from Stage 4 on`;
}
