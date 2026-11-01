import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@ventidoc/auth',
    '@ventidoc/config',
    '@ventidoc/core',
    '@ventidoc/db',
    '@ventidoc/emails',
    '@ventidoc/permissions',
    '@ventidoc/ui',
    '@ventidoc/validation',
  ],
};

export default nextConfig;
