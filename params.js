const PARAMS = {
  canvasW: 360,
  canvasH: 640,

  // Physics
  bulletSpeed: 480,
  bulletRadius: 6,
  maxBounces: 15,

  // Preview ray
  previewDots: 80,
  previewDotSpacing: 14,

  // Cannon
  cannonX: 180,
  cannonY: 590,
  cannonRadius: 18,

  // Target
  targetW: 40,
  targetH: 22,

  // Wall margin (play field)
  wallLeft: 10,
  wallRight: 350,
  wallTop: 60,
  wallBottom: 620,

  // Stage definitions
  // Each stage: { shots, targets: [{x,y,hp},...] }
  // x,y = center of target; hp = hits to destroy (1 or 2)
  stages: [
    // Stage 1 — single target, straight shot tutorial
    {
      shots: 5,
      targets: [
        { x: 180, y: 200, hp: 1 },
      ]
    },
    // Stage 2 — two targets, need one bounce
    {
      shots: 5,
      targets: [
        { x: 80,  y: 180, hp: 1 },
        { x: 280, y: 180, hp: 1 },
      ]
    },
    // Stage 3 — three targets spread
    {
      shots: 6,
      targets: [
        { x: 180, y: 140, hp: 1 },
        { x: 80,  y: 280, hp: 1 },
        { x: 280, y: 280, hp: 1 },
      ]
    },
    // Stage 4 — tough target (hp:2) + helpers
    {
      shots: 6,
      targets: [
        { x: 180, y: 160, hp: 2 },
        { x: 100, y: 320, hp: 1 },
        { x: 260, y: 320, hp: 1 },
      ]
    },
    // Stage 5 — zigzag row
    {
      shots: 7,
      targets: [
        { x: 90,  y: 140, hp: 1 },
        { x: 180, y: 200, hp: 1 },
        { x: 270, y: 140, hp: 1 },
        { x: 90,  y: 300, hp: 1 },
      ]
    },
    // Stage 6 — diamond
    {
      shots: 7,
      targets: [
        { x: 180, y: 120, hp: 1 },
        { x: 100, y: 220, hp: 1 },
        { x: 260, y: 220, hp: 1 },
        { x: 180, y: 320, hp: 1 },
      ]
    },
    // Stage 7 — tough center + corners
    {
      shots: 8,
      targets: [
        { x: 180, y: 200, hp: 2 },
        { x: 60,  y: 130, hp: 1 },
        { x: 300, y: 130, hp: 1 },
        { x: 60,  y: 340, hp: 1 },
        { x: 300, y: 340, hp: 1 },
      ]
    },
    // Stage 8 — grid
    {
      shots: 9,
      targets: [
        { x: 90,  y: 140, hp: 1 },
        { x: 180, y: 140, hp: 1 },
        { x: 270, y: 140, hp: 1 },
        { x: 90,  y: 260, hp: 1 },
        { x: 270, y: 260, hp: 1 },
      ]
    },
    // Stage 9 — two tough targets
    {
      shots: 8,
      targets: [
        { x: 120, y: 180, hp: 2 },
        { x: 240, y: 180, hp: 2 },
        { x: 180, y: 300, hp: 1 },
      ]
    },
    // Stage 10 — fortress
    {
      shots: 10,
      targets: [
        { x: 180, y: 120, hp: 2 },
        { x: 90,  y: 200, hp: 1 },
        { x: 270, y: 200, hp: 1 },
        { x: 90,  y: 300, hp: 1 },
        { x: 270, y: 300, hp: 1 },
        { x: 180, y: 380, hp: 2 },
      ]
    },
    // Stage 11 — scattered tough
    {
      shots: 10,
      targets: [
        { x: 60,  y: 130, hp: 2 },
        { x: 180, y: 160, hp: 1 },
        { x: 300, y: 130, hp: 2 },
        { x: 120, y: 280, hp: 1 },
        { x: 240, y: 280, hp: 1 },
        { x: 180, y: 360, hp: 2 },
      ]
    },
    // Stage 12 — wall bouncer
    {
      shots: 9,
      targets: [
        { x: 50,  y: 160, hp: 1 },
        { x: 310, y: 160, hp: 1 },
        { x: 50,  y: 260, hp: 1 },
        { x: 310, y: 260, hp: 1 },
        { x: 180, y: 210, hp: 2 },
      ]
    },
    // Stage 13 — cross
    {
      shots: 10,
      targets: [
        { x: 180, y: 120, hp: 1 },
        { x: 180, y: 200, hp: 1 },
        { x: 100, y: 200, hp: 1 },
        { x: 260, y: 200, hp: 1 },
        { x: 180, y: 280, hp: 1 },
        { x: 180, y: 360, hp: 2 },
      ]
    },
    // Stage 14 — chaos
    {
      shots: 11,
      targets: [
        { x: 70,  y: 120, hp: 2 },
        { x: 180, y: 140, hp: 1 },
        { x: 290, y: 120, hp: 2 },
        { x: 120, y: 230, hp: 1 },
        { x: 240, y: 230, hp: 1 },
        { x: 70,  y: 320, hp: 2 },
        { x: 290, y: 320, hp: 2 },
      ]
    },
    // Stage 15 — final boss layout
    {
      shots: 12,
      targets: [
        { x: 180, y: 100, hp: 2 },
        { x: 90,  y: 170, hp: 2 },
        { x: 270, y: 170, hp: 2 },
        { x: 180, y: 240, hp: 1 },
        { x: 90,  y: 310, hp: 1 },
        { x: 270, y: 310, hp: 1 },
        { x: 180, y: 380, hp: 2 },
      ]
    },
  ],
};
