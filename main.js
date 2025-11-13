// main.js - Physics Puzzler using Matter.js
// Drop this file in the same folder as index.html & style.css

// Wait for Matter.js to load
window.addEventListener('load', () => {
  const { Engine, Render, Runner, World, Bodies, Body, Mouse, MouseConstraint, Events, Composite, Constraint } = Matter;

  // Canvas & engine setup
  const canvas = document.getElementById('world');
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = Math.max(400, window.innerHeight * 0.78);
  }
  window.addEventListener('resize', resize);
  resize();

  const engine = Engine.create();
  engine.gravity.y = 1; // make gravity obvious
  const world = engine.world;

  const render = Render.create({
    canvas,
    engine,
    options: {
      width: canvas.width,
      height: canvas.height,
      wireframes: false,
      background: 'transparent',
      showAngleIndicator: false
    }
  });

  Render.run(render);
  const runner = Runner.create();
  Runner.run(runner, engine);

  // Utility: draw colored bodies based on label
  function colorFor(body) {
    if (body.isStatic) return '#1f2937';
    if (body.label === 'goal') return '#34d399';
    if (body.label === 'target') return '#10b981';
    if (body.label === 'button') return '#f59e0b';
    if (body.label === 'hazard') return '#ef4444';
    return '#60a5fa';
  }

  // Custom rendering: patch drawing to color bodies
  Events.on(render, 'afterRender', () => {
    const ctx = render.context;
    const bodies = Composite.allBodies(world);
    for (let b of bodies) {
      ctx.beginPath();
      const parts = b.parts.length > 1 ? b.parts.slice(1) : [b];
      for (let p of parts) {
        ctx.moveTo(p.vertices[0].x, p.vertices[0].y);
        for (let v = 1; v < p.vertices.length; v++) {
          ctx.lineTo(p.vertices[v].x, p.vertices[v].y);
        }
        ctx.lineTo(p.vertices[0].x, p.vertices[0].y);
      }
      ctx.fillStyle = colorFor(b);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.stroke();
    }
  });

  // Mouse control & dragging
  const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: { stiffness: 0.2, render: { visible: false } },
  // limit grabbing to dynamic (non-static) bodies
  collisionFilter: { group: 0 }
});


  // Basic boundaries
  const wallThickness = 80;
  function addBounds() {
    const w = render.options.width, h = render.options.height;
    World.add(world, [
      Bodies.rectangle(w / 2, h + wallThickness/2, w, wallThickness, { isStatic: true }), // floor
      Bodies.rectangle(w / 2, -wallThickness/2, w, wallThickness, { isStatic: true }), // ceiling
      Bodies.rectangle(-wallThickness/2, h/2, wallThickness, h, { isStatic: true }), // left
      Bodies.rectangle(w + wallThickness/2, h/2, wallThickness, h, { isStatic: true }) // right
    ]);
  }
  addBounds();

  // Level system
  const levels = [
    {
      name: 'Level 1 — Push to Goal',
      hint: 'Drag the blue box so the green goal falls into the target area.',
      setup: (world, render) => {
        const w = render.options.width, h = render.options.height;
        // ground/platforms
        const p1 = Bodies.rectangle(w/2, h-120, 400, 20, { isStatic: true, angle: -0.08 });
        const p2 = Bodies.rectangle(w/2 + 220, h-240, 400, 20, { isStatic: true, angle: 0.10 });
        // player box (draggable)
        const box = Bodies.rectangle(w/2 - 240, h-300, 48, 48, { label: 'player', restitution: 0.1 });
        // goal (goal must end inside target zone to win)
        const goal = Bodies.circle(w/2 + 260, h-340, 22, { label: 'goal', restitution: 0.4 });
        // target zone (static sensor)
        const target = Bodies.rectangle(w - 80, h - 80, 120, 40, { isStatic: true, isSensor: true, label: 'target' });
        World.add(world, [p1,p2,box,goal,target]);

        // simple spring object: spawn an extra box when button pressed
        const button = Bodies.rectangle(w/2 - 40, h-160, 60, 18, { isStatic: true, label: 'button' });
        World.add(world, button);

        return { goal, target, button };
      }
    },
    {
      name: 'Level 2 — Button & Door',
      hint: 'Press the orange button to open the door, then roll the goal through.',
      setup: (world, render) => {
        const w = render.options.width, h = render.options.height;
        const floor = Bodies.rectangle(w/2, h-60, w-200, 20, { isStatic: true });
        const goal = Bodies.circle(120, h-140, 22, { label: 'goal', restitution: 0.5 });
        const button = Bodies.rectangle(w/2 - 200, h-80, 70, 16, { isStatic: true, label: 'button' });

        // door is a static rectangle that we will remove when pressed
        const door = Bodies.rectangle(w/2 + 100, h-140, 40, 160, { isStatic: true, label: 'door' });
        const target = Bodies.rectangle(w - 80, h-140, 100, 80, { isStatic: true, isSensor: true, label: 'target' });

        World.add(world, [floor, goal, button, door, target]);
        return { goal, target, button, door };
      }
    },
    {
      name: 'Level 3 — Stack & Ramp',
      hint: 'Stack a couple of boxes to reach the elevated ramp and nudge the goal into the target.',
      setup: (world, render) => {
        const w = render.options.width, h = render.options.height;
        const ground = Bodies.rectangle(w/2, h-40, w-100, 20, { isStatic: true });
        const ramp = Bodies.rectangle(w/2 + 150, h-160, 300, 20, { isStatic: true, angle: -0.5 });
        const goal = Bodies.circle(w-120, h-220, 20, { label: 'goal' });
        const box1 = Bodies.rectangle(160, h-140, 60, 60, { label: 'player' });
        const box2 = Bodies.rectangle(220, h-140, 60, 60, { label: 'player' });
        const target = Bodies.rectangle(80, h-80, 120, 40, { isStatic: true, isSensor: true, label: 'target' });
        World.add(world, [ground, ramp, goal, box1, box2, target]);
        return { goal, target };
      }
    }
  ];

  let currentLevel = 0;
  let levelObjects = {};
  const levelNameEl = document.getElementById('levelName');
  const msgEl = document.getElementById('message');
  function showMessage(text, time = 2200) {
    msgEl.textContent = text;
    msgEl.classList.remove('hidden');
    if (time > 0) setTimeout(()=> msgEl.classList.add('hidden'), time);
  }

  // Helpers for clearing dynamic bodies while keeping boundaries
  function clearLevel() {
    const all = Composite.allBodies(world);
    // Remove everything except big static bounds (we'll check by size)
    for (let b of all) {
      if (!b.isStatic || (b.isStatic && b.bounds.max.x - b.bounds.min.x < 500)) {
        // remove sensors and small static pieces used for levels
        World.remove(world, b);
      }
    }
    // Also remove small constraints
    for (let c of Composite.allConstraints(world)) {
      World.remove(world, c);
    }
  }

  // Load level
  function loadLevel(n) {
    clearLevel();
    // re-add bounds to be safe
    addBounds();
    currentLevel = ((n % levels.length) + levels.length) % levels.length;
    const data = levels[currentLevel];
    levelNameEl.textContent = data.name;
    // call setup to create level bodies; store important ones
    levelObjects = data.setup(world, render);
    showMessage(data.hint, 2500);
  }
  loadLevel(0);

  // Simple win detection: goal overlaps target
  Events.on(engine, 'collisionStart', (ev) => {
    for (let pair of ev.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      if (!a || !b) continue;
      // goal & target
      if ((a.label === 'goal' && b.label === 'target') || (b.label === 'goal' && a.label === 'target')) {
        showMessage('Level complete! 🎉', 3000);
      }
      // button pressed
      if ((a.label === 'button' && b.label === 'player') || (b.label === 'button' && a.label === 'player') ||
          (a.label === 'button' && b.label === 'goal') || (b.label === 'button' && a.label === 'goal')) {
        // find door in levelObjects and remove it (if present)
        if (levelObjects.door) {
          World.remove(world, levelObjects.door);
          delete levelObjects.door;
          showMessage('Door opened!');
        }
        // spawn a helper box (demo)
        if (levelObjects.button && !levelObjects._spawned) {
          const spawn = Bodies.rectangle(levelObjects.button.position.x + 60, levelObjects.button.position.y - 80, 40, 40, { label: 'player' });
          World.add(world, spawn);
          levelObjects._spawned = true;
        }
      }
    }
  });

  // UI bindings
  document.getElementById('nextLevel').addEventListener('click', () => loadLevel(currentLevel + 1));
  document.getElementById('prevLevel').addEventListener('click', () => loadLevel(currentLevel - 1));
  document.getElementById('restart').addEventListener('click', () => loadLevel(currentLevel));
  document.getElementById('hint').addEventListener('click', () => showMessage(levels[currentLevel].hint, 4000));

  // Minimal keyboard: R to restart, N/P for next/prev
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') loadLevel(currentLevel);
    if (e.key === 'n' || e.key === 'N') loadLevel(currentLevel + 1);
    if (e.key === 'p' || e.key === 'P') loadLevel(currentLevel - 1);
  });

  // Keep canvas resized during runtime
  (function adapt() {
    Render.lookAt(render, { min: { x: 0, y: 0 }, max: { x: canvas.width, y: canvas.height } });
    requestAnimationFrame(adapt);
  })();

  // Touch friendly: already supported via MouseConstraint
  // Clean up on unload
  window.addEventListener('unload', () => {
    Render.stop(render);
    Runner.stop(runner);
    Engine.clear(engine);
  });
});
