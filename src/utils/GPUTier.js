export function detectGPUTier() {
  try {
    const c  = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return 'low';

    const maxTex      = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    const dbg         = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer    = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL).toLowerCase() : '';
    const mobile      = /adreno|mali|powervr|apple/i.test(renderer) || /mobile/i.test(navigator.userAgent);

    if (maxTex >= 16384 && maxUniforms >= 1024 && !mobile) return 'high';
    if (maxTex >= 8192  && maxUniforms >= 256)              return 'mid';
    return 'low';
  } catch { return 'low'; }
}
