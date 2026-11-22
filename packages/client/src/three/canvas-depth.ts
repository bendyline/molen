// Whether a WebGL context's canvas depth buffer is floating point, which decides whether reversed
// depth helps there. Reversed depth (three's `reversedDepthBuffer`, through EXT_clip_control) puts
// everything far away just above depth zero. A float keeps about seven significant digits however
// small the value, so a reversed float buffer resolves centimeters kilometers away. A fixed-point
// buffer has one absolute step everywhere, 2⁻²⁴ in 24 bits, so reversing it gains nothing: a step
// at distance z is about z² / near × 2⁻²⁴, 58 cm at 700 m behind the 5 cm near plane of a walk or
// vehicle view. That was coarser than the 32 cm lifting a road off the ground, so from an aircraft
// distant roads and runways fought the ground in shimmering stripes.
//
// A page cannot choose the format. The context attributes say only `depth: true`, DEPTH_BITS reads
// 24 on both kinds, and the platform decides. Probed in November 2026: ANGLE on SwiftShader gives
// a float buffer; Direct3D 11, OpenGL and Vulkan on an NVIDIA GPU give 24-bit fixed point. Apple
// GPUs have no 24-bit depth format, so Metal there should give float too (not probed).
//
// So this asks the buffer. Into one pixel it writes two fragment depths a fifth of a 24-bit step
// apart, the second with a greater-than test. A float buffer stores them apart and the second
// fragment wins. A 16- or 24-bit fixed-point buffer stores both as the same step, whether it
// rounds or truncates, and the first one stays.
//
// The probe leaves GL state changed behind three's cache (program, viewport, scissor, depth and
// color state, pixel 0,0 of the canvas). The caller must call `WebGLRenderer.resetState()`
// afterwards. Any failure, including a lost context, answers false. That costs only speed (the
// caller then uses logarithmic depth), never precision.
//
// Related: renderer.ts (`createWebGlRenderer`, the only caller), docs-src/guide/terrain.md.

/** One step of a 24-bit fixed-point depth buffer. */
const STEP_24 = 1 / 0xffffff;
/** Two depths in the middle of one 24-bit (and one 16-bit) step, a fifth of a step apart. */
const FIRST_DEPTH = 1000.1 * STEP_24;
const SECOND_DEPTH = 1000.3 * STEP_24;

const VERTEX = `#version 300 es
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform float depth;
uniform vec4 color;
out vec4 fragColor;
void main() {
  gl_FragDepth = depth;
  fragColor = color;
}`;

/** True when `gl`'s default framebuffer stores depth as floats (see the file comment). */
export function canvasDepthIsFloat(gl: WebGL2RenderingContext): boolean {
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null;
  let vertexArray: WebGLVertexArrayObject | null = null;
  try {
    program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) return false;
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;

    vertexArray = gl.createVertexArray();
    gl.bindVertexArray(vertexArray);
    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const capability of [
      gl.BLEND,
      gl.CULL_FACE,
      gl.STENCIL_TEST,
      gl.POLYGON_OFFSET_FILL,
      gl.SAMPLE_ALPHA_TO_COVERAGE,
      gl.RASTERIZER_DISCARD,
    ]) {
      gl.disable(capability);
    }
    gl.enable(gl.SCISSOR_TEST);
    gl.enable(gl.DEPTH_TEST);
    gl.viewport(0, 0, 1, 1);
    gl.scissor(0, 0, 1, 1);
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const depth = gl.getUniformLocation(program, 'depth');
    const color = gl.getUniformLocation(program, 'color');
    gl.depthFunc(gl.ALWAYS);
    gl.uniform1f(depth, FIRST_DEPTH);
    gl.uniform4f(color, 1, 0, 0, 1);
    gl.drawArrays(gl.POINTS, 0, 1);
    gl.depthFunc(gl.GREATER);
    gl.uniform1f(depth, SECOND_DEPTH);
    gl.uniform4f(color, 0, 1, 0, 1);
    gl.drawArrays(gl.POINTS, 0, 1);

    const pixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    return (pixel[0] ?? 255) < 128 && (pixel[1] ?? 0) >= 128;
  } catch {
    return false;
  } finally {
    try {
      // three's binding state assumes the default vertex array is bound between draws.
      gl.bindVertexArray(null);
      gl.useProgram(null);
      if (vertexArray) gl.deleteVertexArray(vertexArray);
      for (const shader of shaders) gl.deleteShader(shader);
      if (program) gl.deleteProgram(program);
    } catch {
      // A lost context: nothing to release.
    }
  }
}
