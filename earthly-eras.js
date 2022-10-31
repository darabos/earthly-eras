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
const height = new THREE.WebGLRenderTarget(W, H);
const water = new THREE.WebGLRenderTarget(W, H);

const baseshader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4( position, 1.0 );    
    }
  `,
};
const erosion = new THREE.ShaderMaterial({
  ...baseshader,
  fragmentShader: `
    varying vec2 vUv;
    void main() {
        gl_FragColor = vec4( 0.0, vUv.x, vUv.y, 1.0 );
    }
  `,
});
const display = new THREE.ShaderMaterial({
  ...baseshader,
  uniforms: { height: { value: height.texture } },
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D height;
    void main() {
        gl_FragColor = texture2D(height, vUv).brga;
    }
  `,
});

const quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2, 1, 1));
scene.add(quad);
function animate() {
  requestAnimationFrame(animate);
  quad.material = erosion;
  renderer.setRenderTarget(height);
  renderer.render(scene, camera);
  quad.material = display;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
}
animate();
