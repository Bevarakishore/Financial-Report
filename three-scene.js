const canvas = document.querySelector("#balance-scene");
const card = canvas?.closest(".balance-card");
const THREE = window.THREE;

function createAuthVisualization(visualCanvas) {
  if (!THREE) {
    console.warn("The optional login visualization is unavailable; using the CSS grid fallback.");
    return;
  }

  try {
    const renderer = new THREE.WebGLRenderer({ canvas: visualCanvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
    camera.position.set(0, 0, 18);

    const visualization = new THREE.Group();
    scene.add(visualization);
    const bars = [];
    let chartCurve = null;
    const barMaterial = new THREE.MeshPhongMaterial({
      color: 0xe33b4f, emissive: 0x3a0810, specular: 0xff9aa3,
      shininess: 75, transparent: true, opacity: 0.76
    });
    const goldMaterial = new THREE.MeshPhongMaterial({
      color: 0x9f2738, emissive: 0x28070d, specular: 0xff8491,
      shininess: 85, transparent: true, opacity: 0.8
    });
    for (let index = 0; index < 13; index++) {
      const height = 0.9 + ((index * 7 + 3) % 9) * 0.34;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.38, height, 0.48), index % 4 === 0 ? goldMaterial : barMaterial);
      const bevel = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, height, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xffb0b8, transparent: true, opacity: 0.62 })
      );
      bar.add(bevel);
      visualization.add(bar);
      bars.push({ mesh: bar, height, index });
    }

    const trendMaterial = new THREE.MeshBasicMaterial({ color: 0xff6979, transparent: true, opacity: 0.88 });
    let trendLine = null;
    const markers = [];
    for (let index = 0; index < 6; index++) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(index === 5 ? 0.11 : 0.065, 12, 12),
        new THREE.MeshBasicMaterial({ color: index === 5 ? 0xffc0c5 : 0xff7886, transparent: true, opacity: 0.9 })
      );
      visualization.add(marker);
      markers.push(marker);
    }

    const grid = new THREE.Group();
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x9f3542, transparent: true, opacity: 0.2 });
    scene.add(grid);
    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index++) {
      particlePositions[index * 3] = Math.random() * 20 - 10;
      particlePositions[index * 3 + 1] = Math.random() * 12 - 6;
      particlePositions[index * 3 + 2] = Math.random() * -5;
    }
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({ color: 0xf07a87, size: 0.035, transparent: true, opacity: 0.62 })
    );
    scene.add(particles);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const keyLight = new THREE.DirectionalLight(0xffd8dc, 1.45);
    keyLight.position.set(-4, 6, 10);
    scene.add(keyLight);
    const accentLight = new THREE.PointLight(0xec3045, 34, 28);
    accentLight.position.set(5, 1, 8);
    scene.add(accentLight);

    let worldWidth = 16;
    let worldHeight = 14;
    const resize = () => {
      const { width, height } = visualCanvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      worldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      worldWidth = worldHeight * camera.aspect;
      const baseY = -worldHeight * 0.31;
      const step = worldWidth * 0.075;
      const startX = -step * (bars.length - 1) / 2;
      bars.forEach(({ mesh, height: barHeight, index }) => {
        mesh.position.set(startX + index * step, baseY + barHeight / 2, -0.7);
        mesh.scale.y = 1;
        mesh.children[0].position.set(0.14, 0, 0.26);
      });

      while (grid.children.length) {
        const line = grid.children[0];
        grid.remove(line);
        line.geometry.dispose();
      }
      const halfW = worldWidth * 0.54;
      const halfH = worldHeight * 0.48;
      for (let line = -5; line <= 5; line++) {
        const y = line * worldHeight * 0.085;
        const horizontal = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-halfW, y, -2.4), new THREE.Vector3(halfW, y, -2.4)
        ]);
        grid.add(new THREE.Line(horizontal, gridMaterial));
      }
      for (let line = -7; line <= 7; line++) {
        const x = line * worldWidth / 14;
        const vertical = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, -halfH, -2.4), new THREE.Vector3(x, halfH, -2.4)
        ]);
        grid.add(new THREE.Line(vertical, gridMaterial));
      }

      if (trendLine) {
        visualization.remove(trendLine);
        trendLine.geometry.dispose();
      }
      const points = bars.map(({ mesh, height: barHeight }, index) =>
        new THREE.Vector3(mesh.position.x, baseY + barHeight + Math.sin(index * 0.9) * 0.42, 0.1)
      );
      chartCurve = new THREE.CatmullRomCurve3(points);
      trendLine = new THREE.Mesh(new THREE.TubeGeometry(chartCurve, 120, 0.028, 7, false), trendMaterial);
      visualization.add(trendLine);
      markers.forEach((marker, index) => marker.position.copy(chartCurve.getPoint(index / (markers.length - 1))));
      renderer.render(scene, camera);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(visualCanvas);
    resize();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let inView = false;
    const animate = (time) => {
      frame = requestAnimationFrame(animate);
      bars.forEach(({ mesh, height, index }) => {
        mesh.scale.y = 0.84 + 0.16 * (0.5 + 0.5 * Math.sin(time * 0.0011 + index * 0.7));
        mesh.position.y = -worldHeight * 0.31 + height * mesh.scale.y / 2;
      });
      if (chartCurve) {
        const sweep = (time * 0.00006) % 1;
        markers[5].position.copy(chartCurve.getPoint(sweep));
      }
      markers.forEach((marker, index) => {
        marker.material.opacity = 0.42 + 0.46 * (0.5 + 0.5 * Math.sin(time * 0.002 + index));
        marker.scale.setScalar(index === 5 ? 0.82 + 0.32 * (0.5 + 0.5 * Math.sin(time * 0.003)) : 1);
      });
      visualization.rotation.y = Math.sin(time * 0.00022) * 0.045;
      visualization.rotation.x = Math.sin(time * 0.00032) * 0.022;
      particles.rotation.z = time * 0.000018;
      particles.position.y = Math.sin(time * 0.0002) * 0.12;
      renderer.render(scene, camera);
    };
    const startAnimation = () => {
      if (inView && !document.hidden && !frame) frame = requestAnimationFrame(animate);
    };
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) startAnimation();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    visibilityObserver.observe(visualCanvas);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else startAnimation();
    });
  } catch (error) {
    console.warn("The optional login visualization could not be initialized; using the CSS grid fallback.", error);
  }
}

const authCanvas = document.querySelector("#auth-visualization");
if (authCanvas) createAuthVisualization(authCanvas);
const dashboardCanvas = document.querySelector("#dashboard-visualization");
if (dashboardCanvas) createAuthVisualization(dashboardCanvas);

function createLogoScene(logoCanvas) {
  const mark = logoCanvas.closest(".brand-mark");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!THREE) {
    console.warn("The optional Three.js brand logo is unavailable; using the static fallback.");
    return;
  }

  try {
    const renderer = new THREE.WebGLRenderer({ canvas: logoCanvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
    camera.position.z = 4.9;

    const report = new THREE.Group();
    scene.add(report);
    const pageShape = new THREE.Shape();
    pageShape.moveTo(-0.72, -1.02);
    pageShape.lineTo(0.52, -1.02);
    pageShape.quadraticCurveTo(0.72, -1.02, 0.72, -0.82);
    pageShape.lineTo(0.72, 0.68);
    pageShape.lineTo(0.3, 1.02);
    pageShape.lineTo(-0.72, 1.02);
    pageShape.quadraticCurveTo(-0.84, 1.02, -0.84, 0.9);
    pageShape.lineTo(-0.84, -0.9);
    pageShape.quadraticCurveTo(-0.84, -1.02, -0.72, -1.02);
    const page = new THREE.Mesh(
      new THREE.ExtrudeGeometry(pageShape, { depth: 0.28, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.05, bevelThickness: 0.06 }),
      [
        new THREE.MeshPhongMaterial({ color: 0x9e2334, emissive: 0x351018, specular: 0xff8794, shininess: 75 }),
        new THREE.MeshPhongMaterial({ color: 0xfff1f3, emissive: 0x321018, specular: 0xffffff, shininess: 80 })
      ]
    );
    page.geometry.center();
    report.add(page);

    const foldShape = new THREE.Shape();
    foldShape.moveTo(0.27, 0.88);
    foldShape.lineTo(0.65, 0.88);
    foldShape.lineTo(0.27, 0.54);
    foldShape.closePath();
    const fold = new THREE.Mesh(
      new THREE.ExtrudeGeometry(foldShape, { depth: 0.035, bevelEnabled: false }),
      new THREE.MeshPhongMaterial({ color: 0xf17a89, emissive: 0x351018 })
    );
    fold.position.z = 0.18;
    report.add(fold);

    const inkMaterial = new THREE.MeshPhongMaterial({ color: 0xc63a4c, emissive: 0x351018 });
    const addRule = (x, y, width, height = 0.045, material = inkMaterial) => {
      const rule = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.045), material);
      rule.position.set(x, y, 0.2);
      report.add(rule);
    };
    addRule(-0.34, 0.67, 0.62, 0.075);
    addRule(-0.36, 0.47, 0.46, 0.035, new THREE.MeshPhongMaterial({ color: 0xffb7bf }));

    const chart = new THREE.Group();
    chart.position.z = 0.18;
    report.add(chart);
    const barMaterials = [
      new THREE.MeshPhongMaterial({ color: 0x831a2b, emissive: 0x26070d, specular: 0xff7788, shininess: 80 }),
      new THREE.MeshPhongMaterial({ color: 0xa52135, emissive: 0x2c0810, specular: 0xff8d9a, shininess: 80 }),
      new THREE.MeshPhongMaterial({ color: 0xc32b41, emissive: 0x320911, specular: 0xffa0aa, shininess: 80 }),
      new THREE.MeshPhongMaterial({ color: 0xe13b50, emissive: 0x3b0a14, specular: 0xffc0c7, shininess: 80 })
    ];
    const barData = [
      { x: -0.52, height: 0.35 },
      { x: -0.19, height: 0.54 },
      { x: 0.14, height: 0.73 },
      { x: 0.47, height: 0.98 }
    ];
    const bars = barData.map(({ x, height }, index) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 0.22), barMaterials[index]);
      bar.position.set(x, -0.49, 0.3);
      chart.add(bar);
      return { bar, height };
    });
    const axis = new THREE.Mesh(
      new THREE.BoxGeometry(1.32, 0.045, 0.1),
      new THREE.MeshPhongMaterial({ color: 0xc63a4c, emissive: 0x351018 })
    );
    axis.position.set(-0.025, -0.53, 0.3);
    chart.add(axis);
    for (let index = 0; index < 3; index++) {
      const grid = new THREE.Mesh(
        new THREE.BoxGeometry(1.34, 0.012, 0.025),
        new THREE.MeshBasicMaterial({ color: 0xf07886, transparent: true, opacity: 0.68 })
      );
      grid.position.set(-0.025, -0.25 + index * 0.27, 0.24);
      chart.add(grid);
    }

    const trendPoints = [
      new THREE.Vector3(-0.61, -0.13, 0.32),
      new THREE.Vector3(-0.25, 0.08, 0.35),
      new THREE.Vector3(0.11, 0.02, 0.38),
      new THREE.Vector3(0.57, 0.53, 0.4)
    ];
    const trendCurve = new THREE.CatmullRomCurve3(trendPoints);
    const trend = new THREE.Mesh(
      new THREE.TubeGeometry(trendCurve, 32, 0.035, 8, false),
      new THREE.MeshBasicMaterial({ color: 0xff8190 })
    );
    chart.add(trend);
    const tracer = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffc0c7 })
    );
    chart.add(tracer);

    const coinMaterial = new THREE.MeshPhongMaterial({ color: 0xd95364, emissive: 0x45111b, specular: 0xffc0c7, shininess: 95 });
    const coins = new THREE.Group();
    coins.position.set(0.62, -0.73, 0.31);
    report.add(coins);
    for (let index = 0; index < 3; index++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.075, 32), coinMaterial);
      coin.rotation.x = Math.PI / 2;
      coin.position.set(index === 1 ? 0.03 : 0, index === 1 ? 0.12 : index === 2 ? 0.24 : 0, index * 0.06);
      coins.add(coin);
      const stamp = new THREE.Mesh(
        new THREE.TorusGeometry(0.095, 0.012, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xffe1e4 })
      );
      stamp.position.set(coin.position.x, coin.position.y, coin.position.z + 0.043);
      coins.add(stamp);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2);
    keyLight.position.set(-2, 3, 5);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xec3045, 1.8, 8);
    rimLight.position.set(2, -1, 3);
    scene.add(rimLight);

    const resize = () => {
      const { width, height } = logoCanvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mark);
    resize();
    mark.classList.add("has-three-logo");

    if (reducedMotion) {
      bars.forEach(({ bar, height }) => {
        bar.scale.y = height;
        bar.position.y = -0.49 + height / 2;
        bar.position.z = 0.3;
      });
      tracer.position.copy(trendPoints[trendPoints.length - 1]);
      renderer.render(scene, camera);
      return;
    }

    let frame = 0;
    let hoverX = 0;
    let hoverY = 0;
    let hoverTargetX = 0;
    let hoverTargetY = 0;
    const pointerMove = (event) => {
      const rect = mark.getBoundingClientRect();
      hoverTargetY = ((event.clientX - rect.left) / rect.width - 0.5) * 0.85;
      hoverTargetX = ((event.clientY - rect.top) / rect.height - 0.5) * -0.65;
    };
    const pointerLeave = () => { hoverTargetX = 0; hoverTargetY = 0; };
    mark.addEventListener("pointermove", pointerMove);
    mark.addEventListener("pointerleave", pointerLeave);
    const animate = (time) => {
      frame = requestAnimationFrame(animate);
      const elapsed = time - (animate.startedAt || (animate.startedAt = time));
      bars.forEach(({ bar, height }, index) => {
        const reveal = Math.max(0, Math.min(1, (elapsed - index * 110) / 550));
        const eased = 0.58 + 0.42 * (1 - Math.pow(1 - reveal, 3));
        const pulse = 1 + Math.sin(time * 0.002 + index * 0.8) * 0.045 * reveal;
        bar.scale.y = height * eased * pulse;
        bar.position.y = -0.84 + bar.scale.y / 2;
      });
      const progress = (elapsed * 0.00024) % 1;
      tracer.position.copy(trendCurve.getPointAt(progress));
      hoverX += (hoverTargetX - hoverX) * 0.09;
      hoverY += (hoverTargetY - hoverY) * 0.09;
      report.rotation.y = Math.sin(time * 0.00065) * 0.42 + hoverY;
      report.rotation.x = Math.sin(time * 0.0008) * 0.17 + hoverX;
      report.rotation.z = Math.sin(time * 0.0005) * 0.055;
      report.position.y = Math.sin(time * 0.0012) * 0.07;
      report.scale.setScalar(1 + Math.sin(time * 0.0015) * 0.025);
      coins.rotation.y = Math.sin(time * 0.001) * 0.24;
      tracer.scale.setScalar(1 + Math.sin(time * 0.008) * 0.18);
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else frame = requestAnimationFrame(animate);
    });
  } catch (error) {
    console.warn("The optional Three.js brand logo could not be initialized.", error);
  }
}

document.querySelectorAll("[data-three-logo]").forEach(createLogoScene);

if (canvas && card && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  if (!THREE) {
    console.warn("The optional Three.js balance illustration is unavailable; using the static fallback.");
  } else {
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
      camera.position.set(0, 0, 6);

      const group = new THREE.Group();
      group.position.set(1.05, -0.08, 0);
      scene.add(group);
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.73, 2),
        new THREE.MeshPhongMaterial({ color: 0xd8384d, emissive: 0x3b0a14, specular: 0xffa0aa, shininess: 45, flatShading: true })
      );
      group.add(orb);

      const ringMaterial = new THREE.MeshStandardMaterial({
        color: 0xffabb5, roughness: 0.24, metalness: 0.58, transparent: true, opacity: 0.88
      });
      const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.035, 12, 100), ringMaterial);
      ringA.rotation.set(0.82, 0.16, -0.38);
      group.add(ringA);
      const ringB = new THREE.Mesh(
        new THREE.TorusGeometry(1.24, 0.012, 8, 100),
        new THREE.MeshBasicMaterial({ color: 0xf17685, transparent: true, opacity: 0.48 })
      );
      ringB.rotation.set(0.45, -0.5, 0.8);
      group.add(ringB);

      const beadMaterial = new THREE.MeshStandardMaterial({ color: 0xffc0c7, roughness: 0.3, metalness: 0.35 });
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 20), beadMaterial);
      bead.position.set(1.02, 0.68, 0.15);
      group.add(bead);

      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
      keyLight.position.set(-2.5, 3, 4);
      scene.add(keyLight);
      const rimLight = new THREE.PointLight(0xec3045, 2.5, 8);
      rimLight.position.set(2, -1.5, 2.5);
      scene.add(rimLight);

      const resize = () => {
        const { width, height } = canvas.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(card);
      resize();
      card.classList.add("has-three-scene");

      let frame = 0;
      const animate = (time) => {
        frame = requestAnimationFrame(animate);
        group.rotation.y = time * 0.00024;
        group.rotation.x = Math.sin(time * 0.00032) * 0.1;
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(animate);

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          cancelAnimationFrame(frame);
        } else {
          frame = requestAnimationFrame(animate);
        }
      });
    } catch (error) {
      console.warn("The optional Three.js balance illustration could not be initialized.", error);
    }
  }
}
