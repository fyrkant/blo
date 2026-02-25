export function initFuji(canvas) {
  const N = 8; // radial segments — low number = more angular/low-poly look

  // Ring definitions: [y, r] — height (0=base, 1=peak), radius
  const RINGS = [
    [0.00, 1.00],
    [0.45, 0.80],
    [0.68, 0.55],
    [0.82, 0.35], // snow starts here
    [0.92, 0.18],
    [1.00, 0.00], // peak
  ];

  // Build vertices
  const verts = [];
  const ringStart = [];
  for (let i = 0; i < RINGS.length; i++) {
    const [ry, rr] = RINGS[i];
    ringStart.push(verts.length);
    if (rr === 0) {
      verts.push([0, ry, 0]);
    } else {
      for (let j = 0; j < N; j++) {
        const a = (j / N) * Math.PI * 2;
        verts.push([Math.cos(a) * rr, ry, Math.sin(a) * rr]);
      }
    }
  }

  // Build faces: [i0, i1, i2, isSnow]
  // Snow covers the top 2 ring pairs (r >= RINGS.length - 3)
  const faces = [];
  for (let r = 0; r < RINGS.length - 1; r++) {
    const isSnow = r >= RINGS.length - 3;
    const s0 = ringStart[r];
    const s1 = ringStart[r + 1];
    if (RINGS[r + 1][1] === 0) {
      // Triangle fan to peak vertex
      for (let j = 0; j < N; j++) {
        faces.push([s0 + j, s0 + (j + 1) % N, s1, isSnow]);
      }
    } else {
      // Quad strip (two triangles per quad)
      for (let j = 0; j < N; j++) {
        const j1 = (j + 1) % N;
        faces.push([s0 + j, s0 + j1, s1 + j, isSnow]);
        faces.push([s0 + j1, s1 + j1, s1 + j, isSnow]);
      }
    }
  }

  const MOUNTAIN = [80, 95, 115];  // blue-grey rock
  const SNOW = [232, 240, 255];    // cool white snow
  const LIGHT = norm3([0.8, 1.2, 0.4]);

  // View tilt: rotate around X so we see the mountain from slightly above
  const TILT = -0.28; // radians
  const CT = Math.cos(TILT), ST = Math.sin(TILT);

  function norm3([x, y, z]) {
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }
  function dot3([ax, ay, az], [bx, by, bz]) {
    return ax * bx + ay * by + az * bz;
  }
  function cross3([ax, ay, az], [bx, by, bz]) {
    return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
  }
  function sub3([ax, ay, az], [bx, by, bz]) {
    return [ax - bx, ay - by, az - bz];
  }

  canvas.width = 560;
  canvas.height = 440;

  let angle = 0;
  let running = true;

  function draw() {
    if (!running) return;
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const ca = Math.cos(angle), sa = Math.sin(angle);

    // Transform: Y-axis rotation (spin) then X-axis rotation (tilt)
    const rv = verts.map(([x, y, z]) => {
      // Spin around Y
      const x1 = x * ca + z * sa;
      const y1 = y;
      const z1 = -x * sa + z * ca;
      // Tilt around X
      const y2 = y1 * CT - z1 * ST;
      const z2 = y1 * ST + z1 * CT;
      return [x1, y2, z2];
    });

    // Perspective projection
    const FOV = 4;
    const cx = W / 2;
    const cy = H * 0.60;
    const sc = Math.min(W, H) * 0.44;

    const pv = rv.map(([x, y, z]) => {
      const s = FOV / (FOV + z);
      return [cx + x * sc * s, cy - y * sc * s];
    });

    // Compute per-face depth then sort back-to-front (painter's algorithm)
    const fd = faces.map(([i0, i1, i2, isSnow]) => ({
      i0, i1, i2, isSnow,
      z: (rv[i0][2] + rv[i1][2] + rv[i2][2]) / 3,
    }));
    fd.sort((a, b) => b.z - a.z);

    for (const { i0, i1, i2, isSnow } of fd) {
      // Face normal via cross product
      const n = norm3(cross3(sub3(rv[i1], rv[i0]), sub3(rv[i2], rv[i0])));

      // Backface culling: skip faces pointing toward +z (away from viewer)
      if (n[2] > 0) continue;

      // Diffuse lighting using outward normal (negate computed normal)
      const diff = Math.max(0, dot3([-n[0], -n[1], -n[2]], LIGHT));
      const intensity = Math.min(1, 0.18 + 0.82 * diff);

      const base = isSnow ? SNOW : MOUNTAIN;
      const r = Math.round(base[0] * intensity);
      const g = Math.round(base[1] * intensity);
      const b = Math.round(base[2] * intensity);

      ctx.beginPath();
      ctx.moveTo(pv[i0][0], pv[i0][1]);
      ctx.lineTo(pv[i1][0], pv[i1][1]);
      ctx.lineTo(pv[i2][0], pv[i2][1]);
      ctx.closePath();
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fill();
    }

    angle += 0.006;
    requestAnimationFrame(draw);
  }

  draw();

  // Stop animation when canvas is removed from DOM (e.g., SPA navigation)
  new MutationObserver(() => {
    if (!document.body.contains(canvas)) running = false;
  }).observe(document.body, { childList: true, subtree: true });
}
