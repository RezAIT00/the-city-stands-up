# The City Stands Up

One file, `city.html`. The only dependency is three.js 0.180.0 from jsDelivr through an import map. No models, textures, HDRIs, fonts or sounds are downloaded: everything is generated from code when the page loads.

## Running it

Serve or open `city.html` in a Chromium browser with a discrete GPU. It loads in a few seconds (up to about 10 s on a busy machine) and starts in playable mode.

| Key | Action |
| --- | --- |
| T | Transform, forward or back, at any time (if the robot is away from home it walks back first) |
| W A S D, Shift | Walk, stride |
| Left click or J | Punch. Four in quick succession end in a two-handed slam |
| Right mouse or Space | Block |
| G | Grab the nearest building (or the titan). G again, or punch, throws it |
| R | Hold to charge the chest reactor, release to fire |
| B | Rebuild a lost limb from standing blocks |
| P | Freeze the fight or the film and fly: W A S D, Q E, drag to look, wheel for speed |
| 3 | Red-cyan stereo from two real cameras |
| F | Watch the film in the page, with its sound (the sea, the debris, the streets and the mix are computed first: 130 s on the test machine) |
| Enter, H | Restart, hide help |

`city.html?demo=1` is the deterministic version. It exposes `window.renderAt(t)` for t in 0 to 66, `window.pieceReport()` and `window.checkPieces()`. Extra query switches: `sub` (shutter samples per frame), `ss` (supersampling), `w`, `h`.

## How the robot works

Downtown is the robot in a deep squat. Every limb is a cluster of vertical towers standing where the folded limb would be: shin tower, thigh tower, torso towers, arm towers. Standing up is therefore mostly hinges, like unfolding a carpenter's rule.

1. Tower slices (14 m) rotate in place. The outer waist slices slide out, ride up rails and become the shoulders.
2. Street leaves hinge up, towers slide together, blade signs swing 180 degrees across the seams and slam as locks.
3. The stadium tilts on its seaward edge, slides to the torso and rises to the chest. Its 28 roof petals open when the reactor fires.
4. Streets of houses, shops and houseboats roll along the ground, round a fillet and up the limbs as armour. Trains follow rails up the limb edges as tendons.
5. The bridge is a double bascule whose two leaves curl up into the spine. Its masts become the back fins.
6. The torso rises on the spine, leans until the shoulders meet the standing arms, and the whole thing stands by two-bone IK. Every joint hinges on the edge that would otherwise be crushed, the ankles are stacks of discs, and the knees turn on interleaved drum knuckles.

2,106 rigid pieces. The pipeline that draws them stores a position and a quaternion per piece and nothing else, so there is nowhere to put a scale. At the end the same paths run backwards. The pieces of the arm that is torn off are gone, which leaves a gap in the skyline.

## Techniques

- Deferred renderer on three.js with MRT, reversed infinite depth, four shadow cascades with contact-hardening filtering, horizon-based AO at two scales, GGX, screen-space reflections, additive light volumes, physically based sky (Rayleigh, Mie, ozone), AgX.
- Volumetrics: one ray march covers haze with sun shafts, dust, smoke, spray and fire, with self-shadowing. Cloud slab with carving around the giants, the shockwave and the beam hole. The dust wave uses real walking distance through the street network, so it turns corners.
- Windows are recessed geometry. Behind the glass every room is ray traced per pixel (walls, ceiling lights, desks, cabinets, people, blinds), so it holds from any angle.
- The emergence (5 to 12 s) has its own sea. `66_rise.js` samples the titan's body (skull, limbs, reef, wrecks, lighthouse) into spheres, puts them through the real bone matrices every step and uses them as the moving floor of a shallow-water solver (4 m cells, 60 Hz). The water domes over the body, thins, tears, runs off into a churning collar, falls back into the hole and throws a ring. The picture, the boats, the spray and the sound all read that same solution, so nothing breaks flat water. Film: baked once, any frame in any order. Game: the same solver live at 8 m cells.
- Boats in that range are floating bodies on the solved water: suction, slope, the titan's back and shoulders as contact, capsizing, falling off, splashes.
- Water on the body: a displaced running skin on the titan's mesh, rivulets over the reef, and 156 falls (84 on the body, 72 in the reef) that start at real ledges (jaw, lips, brows, horns, gills, elbows, spikes, claws, mantle, wrecks, lighthouse, coral branches) the moment the solver says that point is out. Each sheet remembers where its ledge was when that water let go. The skin darkens and shines from the same moment.
- Sound: `87_synth.js` (seeded synthesis blocks, no samples, no Math.random) and `88_score.js` (172 named cues placed from the film's own events: step lists, rope snap times, collapse floors, lock times, debris impacts, boat positions, solver tears, bolts). Panning, level, filtering and delay come from the film camera. Four high-passed reverbs, scene fader, BS.1770 loudness and a true-peak limiter, all in code. Film mode plays the same mix, locked to the film clock.
- Water is one surface for bay, canal, tsunami and street flood, with Gerstner waves, refraction, reflections and foam. The flood follows street distance from the sea wall.
- The titan is an implicit body polygonised with surface nets, skinned to 60 bones with automatic weights, scute plating, muscle swell driven by joint angle, wrap and transmission lighting, look-at eyes, and a reef of instanced coral, barnacles, kelp, chains, four wrecks and a lighthouse.
- Debris: a fixed-step solver (ground and roof height field, growing pile height field, hashed pair collisions, rolling, settling flat). The film bakes it at load; the game runs the same source in a Web Worker. The hero tower is built from its own 12,686 debris pieces, so nothing is swapped when it breaks.
- Film frames: 12 shutter samples per frame at 3840x2160 with per-sample jitter, velocity blur between samples, depth of field and bloom, averaged in linear HDR, tone mapped, then downscaled to 1920x1080. No state carries over between frames.

## Render command

```
node tools/build.mjs                  # concatenates src/ into city.html
node tools/render.mjs dir=p7 sub=16   # resumable: work/p7/f_00000.png ... f_03959.png, existing frames are skipped
node tools/audio.mjs city.wav         # the sound, 48 kHz 24-bit stereo, 66.000 s
ffmpeg -framerate 60 -i work/p7/f_%05d.png -i city.wav -map 0:v -map 1:a -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -crf 16 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -c:a aac -b:a 320k -ar 48000 -t 66 -movflags +faststart city.mp4
```

Capture uses Edge through playwright-core with `--use-angle=d3d11 --enable-gpu --force_high_performance_gpu --ignore-gpu-blocklist`. Without `--force_high_performance_gpu` this machine renders on its AMD iGPU.

Checks: `node tools/verify.mjs` (piece rule and determinism), `node tools/check_bind.mjs 0 10 0.05` (the same piece rule offline in node).

## Third pass: flood, cars, harbour, claw and ending

The film is now 66.0 s (3,960 frames, 16 shutter samples at 3840x2160). The first 38 s keep their timing. Earlier versions are in `city_v1.*` and `city_v2.*`, old stills in `stills/v2`.

New parts:

- **Streets** (`src/54_street.js`): shallow water on a 360 x 240 grid of 4 m cells between the buildings, fed over the sea wall by the same wave the bay shows, drained back to the bay, into storm drains (counted) and off the ends of the map. Cars, boats and loose things are rigid bodies in it. `src/55_streetview.js` bakes it at load, records keyframes and draws it. Fixed step: 1/60 s in the waves, 1/30 s otherwise.
- **Cars** (`src/56_cars.js`): lofted bodies, see-through glass with seats and a driver, turning and steering wheels, lamps that break, plates, mud that rises with the water. Same solver: lanes, gaps, signals and panic, then water, collisions and wrecks that stay put.
- **Last street** (`src/84_last.js`): people built from rigid parts who walk out and look up, one signal that flickers and turns green, one wrecked car that coughs, lights up and drives round the others.
- **Damage** only grows: buildings, streets and cars through the water's peak level, force and mud maps, robot pieces through `pieceDamage`, lamps and neon through a power cut that stays.
- **Harbour**: deep water at the wall (the seabed drops away), a 3 m drawdown instead of 8.5 m, wet weed band, moorings, boats that ride to their anchors. Boats now collide with the titan's real body, not a height field.
- **Hits**: the tower, the beam and the falling buildings break on the instant of contact.
- **Game** (`src/85_streetlive.js`): the same street solver in a worker. Distant cars are simple shapes there, only in the game.

| Check (final file) | Result |
| --- | --- |
| Flood volume (`flood_volume_log.csv`) | 482,915 m3 in; at the end 79,264 in the streets, 4,715 in the canal, 140,655 back to the bay, 253,341 into storm drains, 4,942 past the ends of the map. Worst imbalance 2 m3, clamped 0 |
| Level drop per second | while draining at most 0.86 m/s (x 465, right after the second wave recedes), under 0.65 elsewhere; in the wave itself up to 13.1 (promenade) |
| Cars moving without water, engine or contact | 0 counted at every step in the solver; one 4 cm drift in half a second in the separate dry check |
| Healing | 0 on 7,004 vehicles, 0 cells of 42 damage maps, 0 of 2,106 robot pieces |
| Props knocked down and staying down | 1,459 |
| Claw (`claw_log.csv`) | contact at 12.8583 s, first 458 pieces released on that solver step (12.8667), 0 pieces left attached inside the claw |
| Hits (`hitLags()`) | claw 8 ms, beam 6 ms, spear 12 ms, torn arm 13 ms, punch 0, broadcast tower 0, 60 building crushes at most 3 ms. Claw, beam and crushes are measured from geometry; for the punch, spear, torn arm and broadcast tower the contact is the scripted event |
| Boats, before the wave | at least 17.0 m of water under every keel, 4,958 samples |
| Boats and the titan's body | 11,026 hull samples, 0 inside. The largest move of a boat is 10 m in 1/30 s |
| Boats | 74: 22 tilt over 25 degrees, 16 capsize, 15 ride more than 20 m up |
| Emergence (`emergence_log.csv`) | 298 rows; the titan's top rises from -36.7 to +343.7 m and never falls; the dome never drops between 6.0 and 6.95 s |
| Camera, 60 Hz over 66 s | never inside anything |
| Piece rule | 2,106 pieces, 873,912 pairs, 0 interpenetrations, scale deviation 1e-15, home error 0 m |
| Determinism | 25 times backwards and 7 shuffled: identical. The finished frame set was compared with the final file on 116 and then 66 sampled frames: all identical |
| Sound | -14.0 LUFS, -2.0 dBTP, LRA 8.1, 66.000 s, 214 cues, no clipped samples; -14.1 LUFS and -1.5 dBTP after AAC. 21 key cues at most 1.1 frames from the picture (`sound/key_cues.txt`) |
| Page load | 2.3 to 2.4 s to the playable game. Film mode in the page starts after 130 s: sea 5, debris 39, streets 18, sound 66 |
| Game, 1080p full resolution, frame limit off | 77 to 85 fps while it rises, 65 to 68 in the flood, 90 to 127 otherwise. The machine also ran other work |
| Film mode in the page | 40 to 53 fps at 60 Hz pacing in headless Edge, with no sound if the page is opened without a click |

The sound was judged from measurements only. Nobody has listened to it.

Frames: the whole film was rendered for this pass. A long render that shared the GPU with other work left 340 frames around 40 to 45 s a few levels off in under 0.02% of pixels, so that stretch was rendered again with the GPU to itself.

`city.mp4` was tagged bt709 (matrix, primaries, transfer) by a lossless bitstream filter after the encode.

Known limits: pedestrians run indoors or are covered by the water and are not simulated as bodies; the 17 to 18 s street holds only about ten floating things near the lens; the second wave's toe is still bare mud; film mode can stall for a moment right after a seek; boats carried into the streets are handed from the bay to the street solver at the 9.95 s cut and their positions jump there; some falling boats move at more than 150 m/s beside the rising titan; the film's own cars are more detailed than the game's beyond 170 m; the ending was judged by eye on stills and sheets, not watched as a film.

Time for this pass: 17:49:47 on 24 November to 01:45 on 25 November, 7 h 55 min.

## Second pass: the emergence and the sound

Only frames 300 to 719 (5.0 to 12.0 s) were re-rendered: 420 frames, 12 shutter samples at 3840x2160, 8.5 min. The other 2,280 are the old PNGs. Proof: the render code of this pass re-rendered 84 of those 2,280 (66 chosen at random plus the edges 297, 298, 299, 720, 721, 722, 723); all 84 PNGs are byte identical to the old ones. (After that only the end card, the shader warm-up at load and the verifier changed; 10 more outside frames from the final file were identical too.) Inside the range, 17 of 18 sampled frames matched on the first try; frame 300 differed by at most 2/255 in 300 values because the GPU driver swaps in an optimised shader after first use. The page now warms its shaders up first, and after that 59 of 59 sampled frames (296 to 330 and 24 others) were byte identical.

| What | Result |
| --- | --- |
| Piece check, final file | 2,106 pieces, 1,732 large, 873,912 pairs, 0 interpenetrations; start 0.0006 m, robot 0.0008 m, home 0 m, scale deviation 1e-15 |
| Determinism, final file | 16 times backwards and 5 shuffled, including 5.0, 7.3, 8.8, 9.6, 11.9 and 12.0 s: identical. The very first frame after a long GPU idle can differ by 1 to 2/255 in a few dozen values |
| Camera check, final file, 60 Hz | never inside anything; closest 1.67 m from the titan at 14.05 s |
| `emergence_log.csv` | 298 rows, 60 per second, 5.0 to 9.95 s |
| Titan's highest point over the undisturbed sea | -36.7 m to +343.7 m, never falls, biggest step 2.43 m per frame, worst step 1.02x its neighbours |
| Highest water over the body | 3.4 m at 6.0 s, 7.9 at 6.25, 14.2 at 6.5, 23.3 at 6.75, 34.8 at 7.0, 43.2 at 7.25; rises without a step back until it tears. After 7.5 s it is the splash crest (37 to 62 m) and moves up to 3.7 m per frame |
| Mean water displacement within 210 m | 0.03 m at 6.0 s to 15 m, biggest step 0.73 m per frame |
| Water leaves the body | first tear at 6.95 s; first dome 6.0 s to head up 9.6 s = 3.6 s |
| Boats | 74 in the bay: 11 capsize, 17 tilt more than 25 degrees, 8 ride more than 20 m up (48 m at most); only 1 ends more than 40 m from where it started, because the suction first pulls them in |
| Sound | -14.0 LUFS integrated, -2.0 dBTP, LRA 7.3 LU, no clipped samples, no isolated jumps (WAV); -14.1 LUFS and -1.6 dBTP after AAC |
| Sync | 21 key cues in `sound/key_cues.txt`, 172 in `sound/all_cues.json`; scheduled onset against the picture at most 1.1 frames, apart from travel delay (up to 0.42 s) and fly-bys that are meant to lead |
| Repeat sound renders | equal to -111 dBFS, not bit identical: Web Audio sums inputs in a varying order |
| Film mode sound | within 50 ms of the film clock through play, seek, pause and resume |
| Game, final build, idle GPU, 1080p full resolution, frame limit off | 88 fps while the titan rises, 100 standing, 110 in the fight |
| `city.mp4` | 1920x1080, 60 fps, 2,700 frames, 45.000 s, H.264 High, yuv420p, CRF 16, AAC-LC 48 kHz stereo 320 kb/s, 189,355,745 bytes |

The sound was judged from measurements only (loudness, true peak, spectrogram, waveform, octave balance, onset times). Nobody has listened to it.

Time for this pass: 15:12:51 to 17:18:38, 2 h 5 min.

## Measured (first pass, kept for reference: city_v1.mp4 and city_v1.html)

Machine: Windows 11, RTX 3090, Edge through playwright-core, `ANGLE (NVIDIA GeForce RTX 3090, Direct3D11)` confirmed with WEBGL_debug_renderer_info.

| What | Result |
| --- | --- |
| Robot pieces | 2,106 rigid pieces, 1,732 of them counted as large |
| Piece check (`tools/verify.mjs`) | 601 moments of the transformation (60 Hz over 10 s), 873,912 large-piece pairs, tolerance 0.15 m: **0 interpenetrations** |
| Scale | largest deviation 9.99e-16 (position and quaternion only, no scale slot) |
| Start pose vs `pieceReport()` | worst error 0.0006 m |
| Robot pose vs `pieceReport()` | worst error 0.0008 m |
| Home again at the end, surviving pieces | worst error 0 m |
| Determinism | the same frames rendered backwards and shuffled are pixel identical |
| Film camera check (final file) | 60 Hz over 45 s against pieces, buildings, titan, street props, ground and flood: never inside anything; one sample inside the 2 m safety margin (14.05 s, 1.67 m from the titan) |
| Film debris | 109,019 pieces, 102,766 come to rest and stay |
| Game debris | pool of 63,000 plus the hero tower's 12,686 pieces; the counter passed 90,000 spawned in one fight |
| Film render | 2,700 frames, 12 shutter samples at 3840x2160, 53.1 min (1.18 s per frame), resumable |
| `city.mp4` | 1920x1080, 60 fps, 2,700 frames, 45.000 s, H.264 High, yuv420p, bt709, no audio, 185,731,670 bytes |

Interactive speed at 1080p, full resolution, frame limit off:

| When | Fps |
| --- | --- |
| Standing fight, GPU to itself (build before the last water shading change) | 111.7 |
| Final build, while an unrelated Blender job used the same GPU: city, not standing | 62 to 112 |
| Final build, same conditions: transformation | 50 to 111 |
| Final build, same conditions: fight | median about 75, worst half-second 32 |
| Final build, same conditions: both arms lost, 25,508 pieces, 21,621 moving | 77.3 |
| Final build, same conditions: late fight, about 90,000 spawned | 77.7 |

The final build was never measured with the GPU to itself for a whole run. With normal 60 Hz pacing in headless Edge the page reports about 53 fps whatever the load. The page lowers its internal resolution (to 60% at most) when it cannot keep up; those numbers were taken with that switched off.

Checked limits of the piece rule: the check covers the stand-up, large pieces against large pieces, using boxes, wedges and drums (nine mesh types stick out of theirs by 0.2 to 0.4 m). It does not cover the static scenery or the fight poses.

Build time: 2026-11-24 10:41:02 to 15:09:23, 4 h 28 min wall clock in total, including the 53 min final render, two earlier renders that were stopped to fix defects, and about 25 min of waiting for the GPU to be free for speed tests.
