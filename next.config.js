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
    
    
};


export default nextConfig

