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

const material = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        gl_Position = vec4( position, 1.0 );    
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
     
    void main() {
        gl_FragColor = vec4( 0.0, vUv.x, vUv.y, 1.0 );
    }
  `,
});
const W = 512;
const H = 512;
const height = new THREE.WebGLRenderTarget(W, H);
const water = new THREE.WebGLRenderTarget(W, H);

const quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2, 1, 1), material);
scene.add(quad);
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
