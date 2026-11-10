import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..');

async function lint(code: string, relativeFilePath: string) {
  const eslint = new ESLint({
    cwd: repoRoot,
    overrideConfigFile: path.join(repoRoot, 'eslint.config.mjs'),
  });
  const results = await eslint.lintText(code, { filePath: path.join(repoRoot, relativeFilePath) });
  const [result] = results;
  if (!result) {
    throw new Error('expected eslint.lintText to return exactly one result');
  }
  return result;
}

describe('apps/web cannot import @ventidoc/db/system', () => {
  it('fails lint on an import of @ventidoc/db/system', async () => {
    const result = await lint(
      "import { withSystem } from '@ventidoc/db/system';\nexport default withSystem;\n",
      'apps/web/app/__fixtures__/system-import.fixture.ts',
    );

    expect(result.messages.map((m) => m.ruleId)).toContain('no-restricted-imports');
  });

  it('does not flag importing the tenant-scoped @ventidoc/db entry point', async () => {
    const result = await lint(
      "import { withTenant } from '@ventidoc/db';\nexport default withTenant;\n",
      'apps/web/app/__fixtures__/tenant-import.fixture.ts',
    );

    expect(result.messages.map((m) => m.ruleId)).not.toContain('no-restricted-imports');
  });
});
