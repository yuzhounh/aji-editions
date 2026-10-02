import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['aji-editions.pages.dev'],
    },
  },
  async headers() {
    return [
      {
        source: '/data/editions-manifest.json',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      {
        source: '/data/editions.:hash([a-f0-9]+).json.gz',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  outputFileTracingIncludes: {
    '/**/*': [
      './src/data/editions/editions.json.gz',
      './public/data/editions.json.gz',
      './src/data/summaries/summaries.json.gz',
      './public/data/summaries.json.gz',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
