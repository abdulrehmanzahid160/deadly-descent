# Deadly Descent

A cinematic 3D mountain-road driving game with a rear chase camera, continuous steering, steep descents, traffic, and vehicle physics.

![Deadly Descent start screen](game-preview.png)

## Play locally

```bash
npm install
npm run dev
```

Then open the URL shown by Vite. Use **Up Arrow** or **W** for normal acceleration, **Space** for boost, **Down Arrow** or **S** to brake, and **Left/Right Arrow** or **A/D** to steer. Press **C** to cycle between chase, hood, and interior cameras.

## Highlights

- Curving, rolling 30 km mountain descent generated from a continuous road function
- High-resolution original asphalt and alpine ground textures with bump mapping and anisotropic filtering
- Atmospheric sky shader, exponential distance fog, dynamic lighting, soft shadows, guardrails, rocks, and detailed trees
- Photorealistic cinematic mountain-road cover, detailed fuel stations, and illuminated roadside restaurants
- Continuous steering, slope gravity, acceleration, fuel-consuming boost, braking, drag, off-road grip loss, body roll, suspension movement, and wheel rotation
- Classic sedan, rally sedan, and pickup handling profiles
- Wide four-lane road with full-width traffic distribution and chase, hood, and interactive interior camera modes
- Moving traffic, closing-speed collisions, close-pass bonuses, fuel cans, and coins
- Responsive multi-touch controls, dedicated mobile boost, safe-area support, and adaptive mobile rendering
- Installable PWA with offline caching and fullscreen landscape mode
- Zero-config Vite deployment on Vercel

## Production

```bash
npm run build
npm run preview
```

The production site is emitted to `dist/`. Import this repository into Vercel; framework detection and build settings work automatically.

## License

MIT
