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
const W = 512;
const H = 512;
function buffer() {
  const b = new THREE.WebGLRenderTarget(W, H);
  b.texture.generateMipmaps = true;
  b.texture.minFilter = THREE.LinearMipmapLinearFilter;
  return b;
}
const baseshader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
};
function Shader(inputs, output, code) {
  this.inputs = inputs;
  this.outputs = output;
  const uniforms = {};
  let prefix = '';
  for (const i of inputs) {
    uniforms[i] = { value: buffers[i].texture };
    prefix += `uniform sampler2D ${i};\n`;
  }
  this.material = new THREE.ShaderMaterial({
    ...baseshader,
    uniforms,
    fragmentShader: `${prefix}varying vec2 vUv;\nvoid main() {\n${code}}`,
  });
  this.render = () => {
    quad.material = this.material;
    renderer.setRenderTarget(buffers[output]);
    renderer.render(scene, camera);
  };
}
const quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2, 1, 1));
scene.add(quad);
function animate() {
  requestAnimationFrame(animate);
  for (const k in shaders) {
    shaders[k].render();
  }
}

const buffers = {
  height: buffer(), // Terrain height.
  cloud: buffer(), // Air water content, cloud density.
  water: buffer(), // Surface water.
  wind: buffer(), // Direction vector.
  sunlight: buffer(),
  vegetation: buffer(),
  display: null,
};

const shaders = {
  erosion: new Shader(
    ['height', 'water'],
    'height',
    `
    gl_FragColor = vec4(0.0, vUv.x, vUv.y, 1.0);
    `
  ),
  display: new Shader(
    ['height', 'cloud'],
    'display',
    `
    gl_FragColor = texture2DLodEXT(height, vUv, 10.0).brga;
    `
  ),
};
animate();
