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
    
};


export default nextConfig

