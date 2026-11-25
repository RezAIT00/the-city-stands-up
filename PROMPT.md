Good answer. Now here is the real job, which the user wants you to build in full. Do the work yourself, with no subagents. Memory and web search are allowed again for this task. Take the time it needs: this is a public showcase, so don't shorten it, skip deliverables or settle for a quick version.

Folder: <project folder> (create it; work only inside it, apart from tool installs and caches). Note the wall-clock start time first so you can report total build time.

Machine: Windows 11, RTX 3090 (24 GB), 16 threads, Node 25, ffmpeg 8.1 on PATH, Edge at C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe, Playwright Chromium builds in %LOCALAPPDATA%\ms-playwright. WebGL must run on the real GPU (check WEBGL_debug_renderer_info, not SwiftShader), e.g. with --use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist. Use a random high port (4xxxx) for any local server. Don't stop processes you didn't start. Run long renders in the background, in resumable segments, so an interruption never loses finished frames.

# Task: THE CITY STANDS UP. A giant-scale 3D film and playable fight in ONE HTML file

A 500 m sea titan walks out of the bay and destroys a living city. Then the city fights back: streets split, skyscrapers hinge and lock together, the bridge folds into a spine, trains race into the arms as tendons, the stadium opens as a chest reactor, and downtown stands up as a 600 m robot. They fight. At the end it kneels and folds itself back into a city.

The titan, robot and city must be your own original designs. Do not copy any existing film, game or toy's characters, names or looks.

## Hard rules
- One file, `city.html`. The only dependency is three.js (core plus `examples/jsm`), pinned to an exact version on jsdelivr or unpkg via an import map. No downloaded models, textures, HDRIs, fonts or sounds. Web Workers from Blob URLs are fine.
- THE BIG RULE: no morphing, scaling, spawning or swapping. The robot is at least 2,000 rigid pieces of the city, each visible in its normal place beforehand. Every piece travels by slides, hinges, rotations and rails, without passing through other large pieces.
- Prove it: `window.pieceReport()` lists each piece's id, city position, robot position and any scale change (always none). Surviving pieces go home at the end. Destroyed pieces stay destroyed, leaving gaps in the skyline.
- The interactive version holds 60 fps at 1080p on a modern GPU.

## SUPER 3D (the user asked for this specifically)
- Real geometry, not pictures of geometry. Near and mid-distance buildings have modelled facades: recessed windows, ledges, balconies, fire escapes, rooftop machinery, signs, and rooms with depth behind the glass. Streets have kerbs, lamps, trees, vehicles and people as meshes. No billboards or flat cards for anything close to the camera.
- Depth in every shot: foreground, midground and background all moving, with strong parallax. Fly between, under and through things: between the titan's legs, through a tower as it breaks, inside the robot's joints while they lock, and along a train as it becomes a tendon.
- Things come at the lens: debris, cars, spray, glass, the punch itself. Nothing clips through the camera.
- Light that describes form: contact shadows, ambient occlusion, bounce, rim light, shadows cast by the giants across whole districts, volumetrics with depth.
- Proof that it is all 3D: P pauses the film or the fight at any instant and gives a free-fly camera, so a viewer can inspect the frozen moment from anywhere. Nothing may fall apart from another angle.
- Key 3 toggles a red-cyan stereo view in the interactive version, rendered from two real cameras with sensible separation for the scale. It is never on in the MP4.

## The film (45.0 s)
- 0-6 s: Golden hour. Glide between towers through a busy city: traffic, trains, crowds, birds, lit offices. The harbour quietly starts to drain.
- 6-12 s: The titan rises. It has slept so long that coral, shipwrecks and a drowned lighthouse grow from its back. Waterfalls pour off it, clouds break around its shoulders, and a surge carries boats and cars up the avenues.
- 12-18 s: Street level, looking up. A claw goes through a tower, which collapses floor by floor from the point of impact. Bridge cables snap one by one. Dust rolls down the streets and swallows the camera's surroundings.
- 18-28 s: The city stands up, in one unbroken orbit. Every streetlight turns red. Locks slam, blocks rotate, trains snake up the limbs, towers become legs. It rises through the dust and its windows light up as eyes.
- 28-38 s: The fight. The first punch lands in extreme slow motion, with glass and water hanging in the air, then a shockwave clears the clouds. The titan rips off an arm, which breaks back into falling buildings. The robot tears out the broadcast tower and uses it as a spear. Rain, fire and lightning.
- 38-45 s: The reactor fires. The beam splits the storm and sunlight pours in. The titan falls and the wave crashes ashore. The robot kneels and folds back into streets. Final shot: one traffic light turns green and one small car drives off.

## Make it insane
- Weight: giants move slowly and the ground reacts late. Feet crush streets, joints strain, water sheds, cars jump with each step. Feet never slide.
- Destruction: floors, columns, facade panels, glass and furniture break where they are hit. At least 50,000 debris pieces collide, pile up and stay.
- Scale: haze, clouds at chest height, birds, helicopters, tiny lit windows with rooms behind them.
- Titan: jointed, with IK, muscle and skin movement, wet translucent flesh, barnacles, glowing gills and eyes that track the robot.
- Rendering: HDR, physically based sky, cascaded shadows, volumetric dust, smoke and light shafts, wet reflections, fire that lights its surroundings, motion blur, depth of field, AgX or ACES, clean anti-aliasing.

## Playable mode (default)
Play as the city: walk, punch, block, grab, throw a building and fire the reactor. The titan blocks, charges, bites and changes tactics. Losing a limb changes how you move, and nearby blocks can rebuild it. T transforms at any time, forward or back. Include health, a camera that sells the scale, a restart, and synthesized WebAudio that starts on the first user gesture.

## Deterministic render
- `city.html?demo=1` exposes `window.renderAt(t)`: exactly one frame for time t, no wall-clock input, identical in any order. Bake physics or replay it at a fixed step.
- `city.mp4`: 1920x1080, 60 fps, exactly 2700 frames, H.264 High, yuv420p, CRF 16, `-movflags +faststart`, no audio, text or UI. Capture frame by frame with `playwright-core` or `puppeteer-core` on the real GPU, rendered at 2x and downscaled. Never screen-record in real time.
- `stills/`: eight PNGs from the film plus two playable screenshots with the HUD. `NOTES.md`: techniques, controls, exact render command and build time.

## These count as failure
Box buildings with flat windows. Pieces clipping through each other or appearing from nowhere. Weightless giants. Towers that sink into the ground instead of breaking. Debris that vanishes. Cuts that hide the transformation. Dust that looks like sprites. Empty streets. Anything that only looks right from the film's camera.

## Quality bar
Build the transformation first. Open your stills at every beat with your image-reading tool and reject them like a VFX supervisor until each could be a film poster. Write an automated check for the piece rule: scale always 1, every piece starts and ends where pieceReport() says, and large pieces don't interpenetrate on sampled frames of the transformation. Report its real numbers. Play a full fight in the browser, test every control including P, 3 and T, and fix what breaks. Measure the interactive frame rate. Extract a frame from the finished MP4 every second, plus 20 consecutive frames from the transformation, and review them before finishing.

## Final reply
Absolute paths to `city.html` and `city.mp4`, ffprobe stats (resolution, fps, frame count, duration, size), controls, total build time, measured fps, piece and debris counts, piece-check results, a 3-line summary, and an honest list of anything that fell short of this spec.
