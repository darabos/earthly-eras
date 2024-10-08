const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
let W, H;
function resize(res) {
  const firstTime = W === undefined;
  W = res;
  H = res;
  const e = renderer.domElement;
  e.style = /*css*/`
    width: calc(min(${100 * (W / H)}vh,100vw));
    height: calc(min(100vh,${100 * (H / W)}vw));
    image-rendering: pixelated;
  `;
  const dpr = 1;//window.devicePixelRatio;
  const size = Math.min(e.clientWidth, e.clientHeight) * dpr;
  renderer.setSize(size, size, false);
  if (!firstTime) {
    // Recreate and copy the buffers.
    const copy = new Shader(['target'], 'target', 'o = texture2D(target, pos);');
    for (const b in buffers) {
      if (!buffers[b]) continue;
      quad.material = copy.material;
      quad.material.uniforms.target = { value: buffers[b].texture };
      const newb = buffer();
      renderer.setRenderTarget(newb);
      renderer.render(scene, camera);
      buffers[b].dispose();
      buffers[b] = newb;
    }
    // Clone the shaders to update the #defined W/H.
    for (const s in shaders) {
      const sh = shaders[s];
      shaders[s] = new Shader(sh.inputs, sh.output, sh.code, sh.extraHeader);
    }
  }
}
resize(128);
function buffer() {
  const b = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
  b.texture.generateMipmaps = true;
  b.texture.minFilter = THREE.LinearMipmapLinearFilter;
  b.texture.magFilter = THREE.NearestFilter;
  b.texture.wrapS = THREE.RepeatWrapping;
  b.texture.wrapT = THREE.RepeatWrapping;
  return b;
}
const baseshader = {
  vertexShader: /*glsl*/`
    varying vec2 vpos;
    void main() {
      vpos = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  glslVersion: THREE.GLSL3,
};
const predefs = /*glsl*/`
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
}
vec3 viridis(float t) {
  const vec3 c0 = vec3(0.2777273272234177, 0.005407344544966578, 0.3340998053353061);
  const vec3 c1 = vec3(0.1050930431085774, 1.404613529898575, 1.384590162594685);
  const vec3 c2 = vec3(-0.3308618287255563, 0.214847559468213, 0.09509516302823659);
  const vec3 c3 = vec3(-4.634230498983486, -5.799100973351585, -19.33244095627987);
  const vec3 c4 = vec3(6.228269936347081, 14.17993336680509, 56.69055260068105);
  const vec3 c5 = vec3(4.776384997670288, -13.74514537774601, -65.35303263337234);
  const vec3 c6 = vec3(-5.435455855934631, 4.645852612178535, 26.3124352495832);
  return c0+t*(c1+t*(c2+t*(c3+t*(c4+t*(c5+t*c6)))));
}
// Simplex noise from https://www.shadertoy.com/view/Msf3WH.
vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1. + 2. * fract(sin(p) * 43758.5453123);
}
float noise(in vec2 p) {
  const float K1 = 0.366025404; // (sqrt(3)-1)/2;
  const float K2 = 0.211324865; // (3-sqrt(3))/6;
  vec2  i = floor(p + (p.x+p.y)*K1);
  vec2  a = p - i + (i.x+i.y)*K2;
  // Fixes discontinuity. (Based on https://www.shadertoy.com/view/4tdSWr.)
  vec2  o = 0.5 + 0.5 * vec2(sign(a.x-a.y), sign(a.y-a.x));
  vec2  b = a - o + K2;
  vec2  c = a - 1.0 + 2.0*K2;
  vec3  h = max(0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0);
  vec3  n = h*h*h*h*vec3(dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
  return dot(n, vec3(70.0));
}
// https://iquilezles.org/articles/normalsSDF/
vec3 normal(const sampler2D t, const int ch, const vec2 p) {
  const vec2 h = vec2(1.0/W, 0);
  return normalize(vec3(
    texture2D(t, p-h.xy)[ch] - texture2D(t, p+h.xy)[ch],
    2.0*h.x,
    texture2D(t, p-h.yx)[ch] - texture2D(t, p+h.yx)[ch]));
}
// From https://www.shadertoy.com/view/Xds3zN
mat3 setCamera(in vec3 ro, in vec3 ta) {
	vec3 cw = normalize(ta-ro);
	vec3 up = vec3(0.,0.,1.);
	vec3 cu = normalize( cross(cw,up) );
	vec3 cv =          ( cross(cu,cw) );
  return mat3( cu, cv, cw );
}
mat2 rot(float an) {
  return mat2(cos(an),-sin(an),sin(an),cos(an));
}
const float PI = 3.14159265359;
`;
class Shader {
  constructor(inputs, output, code, extraHeader) {
    this.inputs = inputs;
    this.output = output;
    this.code = code;
    this.extraHeader = extraHeader;
    const uniforms = {};
    let uniformDeclarations = '';
    for (const i of inputs) {
      uniformDeclarations += `uniform sampler2D ${i};\n`;
    }
    for (const o of shaderOptions) {
      uniformDeclarations += `uniform float ${o};\n`;
    }
    this.material = new THREE.ShaderMaterial({
      ...baseshader,
      uniforms,
      fragmentShader: /*glsl*/`
    #define W ${W}.0
    #define H ${H}.0
    ${predefs}
    ${uniformDeclarations}
    varying vec2 vpos;
    uniform float time;
    uniform float speedup;
    ${extraHeader || ''}
    out vec4 mygl_FragColor;
    void main() {
      vec4 o = vec4(0.0);
      vec2 pos = vpos;
      ${code}
      mygl_FragColor = o;
    }`,
    });
    this.render = time => {
      quad.material = this.material;
      for (const i of inputs) {
        this.material.uniforms[i] = { value: buffers[i].texture };
      }
      this.material.uniforms.time = { value: time };
      this.material.uniforms.speedup = { value: options.speedup };
      for (const o of shaderOptions) {
        this.material.uniforms[o] = { value: options[o] };
      }
      if (output === 'display') {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      } else {
        renderer.setRenderTarget(buffers.temporary);
        renderer.render(scene, camera);
        [buffers.temporary, buffers[output]] = [buffers[output], buffers.temporary];
      }
    };
  }
}

const quad = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2, 1, 1));
scene.add(quad);
const shaderDefaults = {
  cloud_opacity: 0.5,
  cloud_texture: 0.25,
  total_water: 0.25,
  total_land: 0.4,
  evaporation: 1,
  erosion: 1,
  cross_section_y: 0,
  debug_boost: 0,
  camera_angle: 1,
  camera_rotation: 0,
  debug: 1,
};
const shaderOptions = Object.keys(shaderDefaults);
const options = {
  speedup: 0,
  view_layer: 'none',
  paint_layer: 'height.r',
  brush_value: 1,
  resolution: 128,
  record() {
    recorder.start();
  },
  save() {
    recorder.stop();
  },
  debug_view() {
    const v = options.view_layer;
    if (v === 'none') {
      displayShader = defaultDisplayShader;
    } else {
      const [buf, ch] = v.split('.');
      displayShader = new Shader(
        [buf],
        'display',
        /*glsl*/`
        o = texture2D(${buf}, pos);
        #if ${ch ? 1 : 0}
          float v = o.${ch} * exp(debug_boost);
          if (v < 0.) {
            o.rgb = viridis(clamp(-v, 0., .8));
          } else {
            o.rgb = inferno(clamp(v, 0., .8));
          }
        #endif
        o.a = 1.0;
        `,
      );
    }
  },
};

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  hiddenLink.href = url;
  hiddenLink.download = filename;
  hiddenLink.click();
  URL.revokeObjectURL(url);
}
const recorder = new MediaRecorder(renderer.domElement.captureStream());
recorder.ondataavailable = e => saveBlob(e.data, 'video.webm');

let paint = false;
renderer.domElement.addEventListener('pointerdown', () => {
  paint = true;
});
renderer.domElement.addEventListener('pointerup', () => {
  paint = false;
});
renderer.domElement.addEventListener('pointerleave', () => {
  paint = false;
});
renderer.domElement.addEventListener('pointerenter', e => {
  paint = !!e.buttons;
});
let paintShader = new Shader(
  ['target'],
  'target',
  /*glsl*/`
  o = texture2D(target, pos);
  if (length(pos - vec2(mouse_x, 1. - mouse_y)) < 5./W) {
    if (channel < 0) o = vec4(value);
    else o[channel] = value;
  }
  `,
  /*glsl*/`
  uniform float mouse_x;
  uniform float mouse_y;
  uniform int channel;
  uniform float value;
  `
);
renderer.domElement.addEventListener('pointermove', e => {
  if (paint) {
    const rect = e.target.getClientRects()[0];
    quad.material = paintShader.material;
    quad.material.uniforms.mouse_x = { value: e.offsetX / rect.width };
    quad.material.uniforms.mouse_y = { value: e.offsetY / rect.height };
    quad.material.uniforms.value = { value: options.brush_value };
    for (const o of shaderOptions) {
      quad.material.uniforms[o] = { value: options[o] };
    }
    const [buf, ch] = options.paint_layer.split('.');
    quad.material.uniforms.channel = { value: 'rgba'.indexOf(ch) };
    quad.material.uniforms.target = { value: buffers[buf].texture };
    renderer.setRenderTarget(buffers.temporary);
    renderer.render(scene, camera);
    [buffers.temporary, buffers[buf]] = [buffers[buf], buffers.temporary];
  }
});

let time = 0;
let tostep = 0;
function animate() {
  requestAnimationFrame(animate);
  const t = Math.pow(10, options.speedup);
  time += t;
  options.camera_rotation += 0.001;
  if (t > 0.1) {
    for (tostep += t; tostep >= 1; --tostep) {
      for (const k in shaders) {
        if (k.startsWith('x')) continue; // To quickly disable a shader.
        shaders[k].render(time);
      }
    }
    displayShader.render(time);
  } else {
    dayCycleShader.render(time);
    displayShader.render(time);
  }
}
function makeUI() {
  const gui = new lil.GUI();
  gui.add(options, 'speedup').min(-4).max(2);
  const layers = [
    'none',
    ...Object.keys(buffers).flatMap(b => [b, `${b}.r`, `${b}.g`, `${b}.b`, `${b}.a`]),
  ];
  gui.add(options, 'view_layer', layers).onChange(options.debug_view);
  gui.add(options, 'paint_layer', layers);
  gui.add(options, 'brush_value').name('brush value').min(-1).max(1);
  gui.add(options, 'record').name('record video');
  gui.add(options, 'save').name('save video');
  const shaderControls = {};
  for (const o of shaderOptions) {
    options[o] = shaderDefaults[o] ?? 1;
    shaderControls[o] = gui.add(options, o).min(0).max(5);
  }
  gui.add(options, 'resolution').min(1).max(2048).step(1).onChange(resize);
  shaderControls['cross_section_y'].name('cross section Y').min(0).max(H).step(1);
  shaderControls['debug_boost'].min(-5);
}

const buffers = {
  height: buffer(), // Terrain height.
  cloud: buffer(), // Air water content, cloud density, rainfall.
  water: buffer(), // Surface water, carried dirt, temp.
  wind: buffer(), // Direction vector.
  sunlight: buffer(),
  vegetation: buffer(),
  temporary: buffer(),
  display: null,
};

const soil = 0.01; // This much water is present as groundwater.
const shaders = {
  preserve_total_land: new Shader(
    ['height'],
    'height',
    /*glsl*/`
    o = texture2D(height, pos);
    float avg = texture2DLodEXT(height, pos, 100.0).r;
    // DEBUG: Compensate for total land in a central region.
    // if (time < 1000.) avg *= noise(20.*pos + vec2(time));
    // if (abs(0.5-pos.x) < 0.2 && abs(0.5-pos.y) < 0.3) {
    //   o.r += 0.01 * pos.x * (total_land*0.2 - avg);
    // }
    o.r += 0.01 * (total_land - avg);
    o.r = clamp(o.r, 0., 1.);
    `
  ),
  evaporate: new Shader(
    ['water'],
    'water',
    /*glsl*/`
    o = texture2D(water, pos);
    // Evaporated amount.
    o.b = clamp(o.r - ${soil}, 0., evaporation*0.0001);
    o.r -= o.b;
    `
  ),
  clouds: new Shader(
    ['water', 'cloud', 'height'],
    'cloud',
    /*glsl*/`
    vec4 w = texture2D(water, pos);
    float h = texture2D(height, pos).r + w.r;
    vec2 wind = vec2(-1./W, 1./H);
    o = texture2D(cloud, pos + wind);
    o.r += w.b * 100.;
    float temperature = clamp(1. - h, 0., 0.5);
    // Linear guesses.
    float max_humidity = temperature;
    float max_cloud = temperature;

    // Rainfall.
    o.b = 0.2*max(0., o.r - max_humidity - max_cloud);
    // Water content.
    o.r -= o.b;
    // Cloud density.
    o.g = max(0., o.r - max_humidity);
    `
  ),
  rain: new Shader(
    ['water', 'cloud'],
    'water',
    /*glsl*/`
    vec4 cl = texture2D(cloud, pos);
    o = texture2D(water, pos);
    o.r += cl.b * 0.01;
    `
  ),
  preserve_total_water: new Shader(
    ['water'],
    'water',
    /*glsl*/`
    o = texture2D(water, pos);
    float avg = texture2DLodEXT(water, pos, 100.0).r;
    o.r += 0.01 * (total_water - avg);
    `
  ),
  water_flowing: new Shader(
    ['height', 'water'],
    'water',
    /*glsl*/`
    // Flowing.
    vec4 h = texture2D(height, pos);
    vec4 w = texture2D(water, pos);
    vec4 win = vec4(0.0);
    vec4 wout = vec4(0.0);
    float SIZE = 3.0;
    for (float dx = -SIZE; dx <= SIZE; ++dx) {
      for (float dy = -SIZE; dy <= SIZE; ++dy) {
        if (dx == 0.0 && dy == 0.0) continue;
        vec4 h2 = texture2D(height, pos + vec2(dx/W, dy/H));
        vec4 w2 = texture2D(water, pos + vec2(dx/W, dy/H));
        float flow_out = clamp(h.r+w.r-h2.r-w2.r, -w2.r, w.r);
        wout += clamp(flow_out * vec4(1., w.g/w.r, 0., 0.), 0., 1.);
        win += clamp(-flow_out * vec4(1., w2.g/w2.r, 0., 0.), 0., 1.);
      }
    }
    float scale = 1.0 / (SIZE*2.0 + 1.0) / (SIZE*2.0 + 1.0);
    o = clamp(w + scale*win - scale*wout, 0.0, 1.0);
    // Erosion.
    float capacity = win.r + wout.r;
    o.b = 0.01*(capacity - o.g);
    // Carried sediment.
    o.g += o.b;
    `
  ),
  water_erosion: new Shader(
    ['height', 'water'],
    'height',
    /*glsl*/`
    vec4 w = texture2D(water, pos);
    o = texture2D(height, pos);
    o.r -= 0.01*erosion*w.b;
    o.b = o.r + max(0., w.r - ${soil}); // Ground + water height.
    `
  ),
  sunlight: new Shader(
    ['height', 'sunlight'],
    'sunlight',
    /*glsl*/`
    vec3 sun = vec3(1, 2, 1);
    vec3 nor = normal(height, 0, pos);
    float direct = clamp(dot(nor, normalize(sun)), 0., 1.);
    o = vec4(0.5 + direct);
    `
  ),
  vegetation: new Shader(
    ['height', 'water', 'vegetation'],
    'vegetation',
    /*glsl*/`
    float w = texture2D(water, pos).r;
    o = texture2D(vegetation, pos);
    float stable;
    if (w < ${soil}) stable = pow(w / ${soil}, 0.2);
    o.r = mix(o.r, stable, 0.001);
    `
  ),
};
const crossSectionShaderText = /*glsl*/`
  vec2 p = vec2(pos.x, cross_section_y/H);
  float h = texture2D(height, p).r;
  vec4 w = texture2D(water, p);
  vec4 cl = texture2D(cloud, p);
  float v = texture2D(vegetation, p).r;
  float y = pos.y*2.-0.1;
  if (y<h) {
    o = vec4(0.4, 0.3+v, 0.1, 1.0);
  } else if (y<h+min(0.1*w.g,w.r)) {
    o = vec4(0., 0.1, 0.2, .3);
  } else if (y<h+w.r) {
    o = vec4(0., 0.1, 0.5, 1.0);
  } else if (y>1.9-cl.g) {
    o = vec4(1.);
  } else {
    o = vec4(0.6, 0.7, 1.0, 1.0)*(1.-cl.b);
  }
  // DEBUG: Show some amount as a chart overlay.
  // if (y>2.-w.a*10.) o *= 0.9;
  // Horizontal line at the cross section.
  if (p.y < pos.y && p.y+0.005 > pos.y) {
    o *= 1.2;
  }
`;
const topDownShaderText = /*glsl*/`
  pos.x = floor(pos.x * W)/W;
  pos.y = floor(pos.y * H)/H;
  float h = texture2D(height, pos).r;
  float cl = texture2DLodEXT(cloud, pos, 2.).g;
  // Surface water.
  float w = max(0., texture2D(water, pos).r - ${soil});
  vec3 s = texture2D(sunlight, pos).rgb;
  float v = texture2D(vegetation, pos).r;

  vec3 c = vec3(1.);
  c.rb *= 1. - v;
  c *= s;

  // Underwater.
  vec3 sea = vec3(0.01, 0.1, 0.3);
  c *= sea / (sea + w);

  // Specular.
  vec3 sun = normalize(vec3(1, 2, 1));
  vec3 nor = normal(height, 2, pos);
  c += min(w, 0.01)*100.*pow(clamp(dot(nor, sun), 0., 1.), 16.);

  // Clouds.
  float scale = 0.4;
  float ct = 0.; // Cloud texture.
  vec2 q = pos;
  for (float str = 0.4; str > 0.03; str *= 0.6) {
    q = mat2(1.2,1.3,-1.4,1.5)*q - 0.001*time;
    ct += abs(str * noise(q));
  }
  c += cloud_opacity * clamp(mix(1., 2.*ct, cloud_texture) + 2.*cl - 1., 0., 1.);

  // Gain.
  c = c * 3. / (2.5 + c);
  c = pow(c, vec3(0.4545));
  o = vec4(c, 1.0);
  `;
const raymarchingShaderText = /*glsl*/`
  // ray origin (camera position)
  vec3 ro = vec3(0., 0., 1.);
  ro.xz = rot(camera_angle) * ro.xz;
  ro.xy = rot(camera_rotation+PI*.5) * ro.xy;
  // camera target
  vec3 ta = vec3(0., 0., 0.);
  mat3 ca = setCamera(ro, ta);
  const float SCALE=6.;
  const float RESOLUTION=100.;
  // ray direction
  float fov = .5;
  vec3 rd = ca * normalize(vec3(2.*(pos - 0.5), 1./fov));
  o = vec4(ro+2.*rd,1.);
  int found = 0;
  vec3 hit;
  for (int i=0; i<int(RESOLUTION)*2; i++) {
    vec3 p = ro + (pow(1.001, float(i)/RESOLUTION)-1.)*1000.*rd;
    vec2 cell = vec2(floor(p.x * W)/W, floor(p.y * H)/H);
    if (abs(cell.x) > .5 || abs(cell.y) > .5) continue;
    cell += 0.5;
    float h = texture2D(height, cell).r;
    float w = max(0., texture2D(water, cell).r - ${soil});
    vec3 s = texture2D(sunlight, cell).rgb;
    float v = texture2D(vegetation, cell).r;

    vec3 c = vec3(1.);
    c.rb *= 1. - v;
    c *= s;

    // Underwater.
    vec3 sea = vec3(0.01, 0.1, 0.3);
    c *= sea / (sea + w);

    if (p.z>0. && p.z*SCALE < h && found == 0) {
      o = vec4(c, 1.);
      // o = vec4(inferno(h*4.), 1.);
      found = 1; // Break gives glitchy results.
      hit = p;
    }
  }
  // Cast another ray toward the sun for the shadow.
  // TODO: Put this in the sunlight shader.
  if (found == 1) {
    found = 0;
    ro = hit;
    float t = 20. * time;
    vec3 timed_sun = vec3(cos(t), 0.1+0.8*sin(t), 2.+0.2*sin(t));
    vec3 fixed_sun = normalize(vec3(1., 2., 1.));
    rd = mix(fixed_sun, timed_sun, clamp(-1.-speedup, 0., 1.));
    for (int i=3; i<int(RESOLUTION)*2; i++) {
      vec3 p = ro + float(i)/RESOLUTION*rd;
      vec2 cell = vec2(floor(p.x * W)/W, floor(p.y * H)/H);
      if (abs(cell.x) > .5 || abs(cell.y) > .5) continue;
      cell += 0.5;
      float h = texture2D(height, cell).r;
      float w = max(0., texture2D(water, cell).r - ${soil});
      if (p.z>0. && p.z*SCALE < h && found == 0) {
        found = 1; // Break gives glitchy results.
        o *= 0.5;
      }
    }
  }
  `;
const defaultDisplayShader = new Shader(
  ['height', 'water', 'cloud', 'sunlight', 'vegetation'],
  'display',
  /*glsl*/`
  if (cross_section_y > 0.) {
    ${crossSectionShaderText}
  } else if (camera_angle > 0.) {
    ${raymarchingShaderText}
  } else {
    ${topDownShaderText}
  }
  `,
 );
const dayCycleShader = new Shader(
    ['height'],
    'sunlight',
    /*glsl*/`
    // Day-cycle model.
    float t = 20. * time;
    vec3 sun = vec3(cos(t), 0.1+0.8*sin(t), 2.+0.2*sin(t));
    vec3 nor = normal(height, 0, pos);
    float direct = clamp(dot(nor, normalize(sun)), 0., 1.);
    vec3 c = vec3(0.1*sun.y + direct);
    if (sun.y < 0.) {
      float n = 0.05*dot(nor, normalize(vec3(0,1,.1)));
      vec3 night = vec3(0.6*n, 0.6*n, n);
      c = mix(night, c, exp(vec3(5.,10.,10.)*sun.y));
    }

    // Simple model.
    sun = vec3(1, 2, 1);
    direct = clamp(dot(nor, normalize(sun)), 0., 1.);
    vec3 s = vec3(0.5 + direct);

    o = vec4(mix(s, c, clamp(-1.-speedup, 0., 1.)), 1.);
    `
  );
let displayShader = defaultDisplayShader;
animate(0);
makeUI();
