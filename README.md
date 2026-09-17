# Deadly Descent

A Three.js alpine driving game: a detailed 458 Italia, a continuous 30 km descent, moving traffic, and a live 3D garage. The Alpine Collection upgrade replaces the previous cover image and primitive player car with the same rendered world used during driving.

![Deadly Descent start screen](game-preview.png)

## Play locally

```bash
npm install
npm run dev
```

Then open the URL shown by Vite and select **Start your descent**. W / Up accelerates, S / Down brakes, A/D or Left/Right steers, Space boosts, C cycles chase/hood/cockpit cameras, and P / Escape pauses. Touch devices have simultaneous steering, brake, accelerator, and boost controls. Switching tabs automatically pauses the run.

## Highlights

- Detailed, locally hosted Draco-compressed car with clearcoat paint, reflective glass, alloy wheels, a visible interior, animated wheels/steering, and responsive brake lights
- Four paint finishes, Touring/Sport handling, and Alpine Morning/Golden Hour lighting
- Procedural asphalt grain, cracks, tyre traces under braking, road shoulders, double centre lines, continuous metal barriers, and roadside signs
- Layered mountain ridges, textured terrain, instanced pine forests, rocks, and grass
- Sky-based environment reflections, a following sun shadow, soft contact shadow, restrained bloom, and filmic tone mapping
- Moving sedan/pickup/truck traffic, collision detection, close-pass bonuses, fuel pickups, and a persistent best distance
- Engine audio, run completion, restart, pause, fullscreen, and portrait/landscape touch layouts
- Ultra, Balanced, and Performance rendering settings; mobile starts on Balanced
- PWA caching for assets visited online; the detailed model has a procedural fallback if its download fails
- Vite production output compatible with Vercel

Graphics are browser-rendered and performance depends on the GPU. Ultra adds bloom and vegetation shadows. Performance reduces rendering resolution and skips post-processing. The environments and traffic are procedural; the detailed player vehicle is an attributed third-party model.

## Checks

```bash
npm run lint
npm run build
npm run dev -- --host 127.0.0.1 --port 5174
# In a second terminal:
npm run test:browser
```

Browser checks cover desktop driving, paint/lighting, cameras, pause, collisions, restart, mobile multitouch and cancellation. They use installed Chrome on Windows; on other platforms install Playwright Chromium with `npx playwright install chromium`. Set `TEST_URL` to use another development-server address. The inspection hook is available only in development with `?test`. Screenshots go to ignored `artifacts/`.

## Structure and credits

- `src/game.js`: simulation, cameras, rendering, audio and input lifecycle
- `src/world.js`: terrain, atmosphere, instanced scenery and road furniture
- `src/vehicles.js`: detailed car loader/materials and procedural traffic
- `src/road.js`: shared road frames and terrain height sampling
- `src/App.jsx`, `src/styles.css`: garage, HUD and responsive controls

The 458 Italia model is by **vicent091036**, sourced from the official Three.js r185 examples. Attribution appears in the garage and [public/credits.txt](public/credits.txt). The game is not affiliated with Ferrari.

## Production

```bash
npm run build
npm run preview
```

The production site is emitted to `dist/`. Import this repository into Vercel; framework detection and build settings work automatically.

## License

MIT
