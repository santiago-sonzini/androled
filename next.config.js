/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        ignoreDuringBuilds: true,

    },
    images: {
        remotePatterns: [
            {
              protocol: 'https', // ✅ sin los dos puntos
              hostname: 'wnziihzxwhwxfwxkkulo.supabase.co', // ✅ dominio correcto del bucket
              pathname: '/storage/v1/object/public/eventos/**', // ✅ patrón correcto
            },
          ],      },
    allowedDevOrigins: ['http://localhost:3000', 'http://mac.local:3000'],
    // Cartas del álbum: cache larga e inmutable. Se precargan al entrar y, una
    // vez bajadas, quedan en caché del navegador — el usuario nunca espera.
    async headers() {
        return [
            {
                source: '/figus/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
        ];
    },
};


export default nextConfig

