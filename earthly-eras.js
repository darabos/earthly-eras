const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const renderer = new THREE.WebGLRenderer({
  antialias: false,
});
function resize() {
  const a = Math.min(window.innerWidth, window.innerHeight);
  renderer.setSize(a, a);
}
resize();
document.body.appendChild(renderer.domElement);
window.addEventListener('resize', resize());
const scene = new THREE.Scene();
const W = 64;
const H = W;
function buffer() {
  const b = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
  b.texture.generateMipmaps = true;
  b.texture.minFilter = THREE.LinearMipmapLinearFilter;
  b.texture.magFilter = THREE.NearestFilter;
  return b;
}
const baseshader = {
  vertexShader: `
    varying vec2 pos;
    void main() {
      pos = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
};
const inferno = `
// From https://observablehq.com/@flimsyhat/webgl-color-maps.
vec3 inferno(float t) {
    const vec3 c0 = vec3(0.0002189403691192265, 0.001651004631001012, -0.01948089843709184);
    const vec3 c1 = vec3(0.1065134194856116, 0.5639564367884091, 3.932712388889277);
    const vec3 c2 = vec3(11.60249308247187, -3.972853965665698, -15.9423941062914);
    const vec3 c3 = vec3(-41.70399613139459, 17.43639888205313, 44.35414519872813);
    const vec3 c4 = vec3(77.162935699427, -33.40235894210092, -81.80730925738993);
    const vec3 c5 = vec3(-71.31942824499214, 32.62606426397723, 73.20951985803202);
    const vec3 c6 = vec3(25.13112622477341, -12.24266895238567, -23.07032500287172);
    return c0+t*(c1+t*(c2+t*(c3+t*(c4+t*(c5+t*c6)))));

}`;
const random = `
// http://www.jcgt.org/published/0009/03/02/
uvec3 random(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y*v.z;
    v.y += v.z*v.x;
    v.z += v.x*v.y;
    v ^= v >> 16u;
    v.x += v.y*v.z;
    v.y += v.z*v.x;
    v.z += v.x*v.y;
    return v;
}
vec3 frandom(vec3 v) {
  return vec3(random(uvec3(v*W))) * (1.0/float(0xffffffffu));
}
`;
function Shader(inputs, output, code) {
  this.inputs = inputs;
  this.outputs = output;
  const uniforms = {};
  let uniformDeclarations = '';
  for (const i of inputs) {
    uniforms[i] = { value: buffers[i].texture };
    uniformDeclarations += `uniform sampler2D ${i};\n`;
  }
  this.material = new THREE.ShaderMaterial({
    ...baseshader,
    uniforms,
    fragmentShader: `
    #define W ${W}.0
    #define H ${H}.0
    ${inferno}
    ${random}
    ${uniformDeclarations}
    varying vec2 pos;
    uniform float time;
    void main() {
      vec4 o = vec4(0.0);
      ${code}
      gl_FragColor = o;
    }`,
  });
  this.render = time => {
    quad.material = this.material;
    this.material.uniforms.time = { value: time };
    if (output === 'display') {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    } else {
      renderer.setRenderTarget(buffers.temporary);
      renderer.render(scene, camera);
      for (const sh in shaders) {
        const us = shaders[sh].material.uniforms;
        if (us[output]) {
          us[output] = { value: buffers.temporary.texture };
        }
      }
      [buffers.temporary, buffers[output]] = [buffers[output], buffers.temporary];
    }
  };
}
const quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2, 1, 1));
scene.add(quad);
function animate(time) {
  requestAnimationFrame(animate);
  for (const k in shaders) {
    shaders[k].render(time);
  }
}

const buffers = {
  height: buffer(), // Terrain height.
  cloud: buffer(), // Air water content, cloud density.
  water: buffer(), // Surface water.
  wind: buffer(), // Direction vector.
  sunlight: buffer(),
  vegetation: buffer(),
  temporary: buffer(),
  display: null,
};

const shaders = {
  preserve_total_land: new Shader(
    ['height'],
    'height',
    `
    o = texture2D(height, pos);
    float avg = texture2DLodEXT(height, pos, 100.0).r;
    if (abs(0.5-pos.x) < 0.2 && abs(0.5-pos.y) < 0.3)
    o.r += 0.01 * (0.5 - avg);
    `
  ),
  preserve_total_water: new Shader(
    ['water'],
    'water',
    `
    o = texture2D(water, pos);
    float avg = texture2DLodEXT(water, pos, 100.0).r;
    if (abs(0.5-pos.x) < 0.2 && abs(0.5-pos.y) < 0.3)
    o.r += 0.01 * (0.8 - avg);
    `
  ),
  water_flowing: new Shader(
    ['height', 'water'],
    'water',
    `
    float h = texture2D(height, pos).r;
    o = texture2D(water, pos);
    float w = o.r;
    float win = 0.0;
    float wout = 0.0;
    float SIZE = 3.0;
    for (float dx = -SIZE; dx <= SIZE; ++dx) {
      for (float dy = -SIZE; dy <= SIZE; ++dy) {
        if (dx == 0.0 && dy == 0.0) continue;
        float h2 = texture2D(height, pos + vec2(dx/W, dy/H)).r;
        float w2 = texture2D(water, pos + vec2(dx/W, dy/H)).r;
        wout += clamp(h+w-h2-w2, 0.0, w);
        win += clamp(h2+w2-h-w, 0.0, w2);
      }
    }
    float scale = 1.0 / (SIZE*2.0 + 1.0) / (SIZE*2.0 + 1.0);
    o.r = clamp(w + scale*win - scale*wout, 0.0, 1.0);
    o.g = win;
    o.b = wout;
    `
  ),
  water_erosion: new Shader(
    ['height', 'water'],
    'height',
    `
    o = texture2D(height, pos);
    `
  ),
  display: new Shader(
    ['height', 'water', 'cloud'],
    'display',
    `
    float h = texture2D(height, pos).r;
    float w = texture2D(water, pos).r;
    o.g = h;
    o.b = w;
    o.a = 1.0;
    `
  ),
};
animate(0);
