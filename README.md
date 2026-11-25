# The City Stands Up

A 66-second 3D film and a playable fight in one HTML file. A sea titan destroys a city, then downtown stands up as a 600 m robot made of 2,106 rigid pieces of that city. Built by Claude Opus 5.5 at extra-high effort. All geometry, textures and sound are generated in code, with three.js as the only dependency.

**Download:** [everything as a zip (278 MB)](https://github.com/RezAIT00/the-city-stands-up/releases/latest/download/the-city-stands-up.zip) or [just the video (259 MB)](https://github.com/RezAIT00/the-city-stands-up/releases/latest/download/city.mp4)

| File | What it is |
| --- | --- |
| `city.mp4` | The film: 1920x1080, 60 fps, 66 s, stereo sound (in the zip and on the Releases page, because it's too big for the repo) |
| `city.html` | The playable version. Open it in Chrome or Edge on a PC with a dedicated graphics card and an internet connection (three.js loads from jsDelivr) |
| `PROMPT.md` | The original prompt |
| `source/` | The code `city.html` is built from, the render scripts, the soundtrack and the build notes |

`PROMPT.md` asked for a silent 45-second film. Later rounds of changes added the sound and the longer ending. The only edit to the prompt is that the project's folder path is shown as `<project folder>`. It opens with "Good answer" because the agent was asked a separate question first.

**First launch:** the page freezes for about 35 seconds while the browser compiles the shaders (measured on an RTX 3090). Leave it alone and it starts. After that it opens in about 3 seconds.

## Controls

| Key | Action |
| --- | --- |
| T | Transform, forward or back |
| W A S D, Shift | Walk, stride |
| Left click or J | Punch |
| Right mouse or Space | Block |
| G | Grab and throw |
| R | Hold to charge the reactor, release to fire |
| B | Rebuild a lost limb |
| P | Freeze and fly |
| 3 | Red-cyan stereo |
| F | Watch the film in the page (takes about two minutes to prepare) |
| Enter, H | Restart, hide help |

## Rebuild it

Needs Node, ffmpeg and Edge on Windows (the Edge path is set in `source/tools/lib.mjs`). Run inside `source/`:

```
npm install
mkdir work
node tools/build.mjs
node tools/render.mjs dir=p7 sub=16
node tools/audio.mjs city.wav
```

The ffmpeg command that joins the frames and sound is in `source/NOTES.md`. Those notes also mention older versions, stills and check logs that aren't included here.
