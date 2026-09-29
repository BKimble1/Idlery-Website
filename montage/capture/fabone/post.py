#!/usr/bin/env python3
"""Post-process a rendered shot: <shotDir>/frames/%05d.png ->
  <shotDir>/<name>.mp4 (libx264, crf 12, preset slow, yuv420p, 30 fps, +faststart),
  4 stills (first, 1/3, 2/3, last), a contact sheet (one frame per second, tiled),
  then deletes the PNG sequence once the MP4 is verified (frame count + size).
  python3 post.py <shotDir> [--keep]
"""
import glob, json, os, re, shutil, subprocess, sys
from PIL import Image, ImageDraw

FFMPEG = '/usr/local/bin/ffmpeg'
d = sys.argv[1].rstrip('/')
keep = '--keep' in sys.argv
name = os.path.basename(d)
frames = sorted(glob.glob(os.path.join(d, 'frames', '*.png')))
n = len(frames)
assert n > 0, 'no frames'
# the sequence must be contiguous from 00000
for i, f in enumerate(frames):
    assert os.path.basename(f) == f'{i:05d}.png', f'gap at {i}: {f}'
w, h = Image.open(frames[0]).size
sizes = {Image.open(f).size for f in (frames[0], frames[n // 2], frames[-1])}
assert len(sizes) == 1, f'frame sizes differ: {sizes}'
mp4 = os.path.join(d, f'fabone-{name}-{w}x{h}-30fps.mp4')
subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-framerate', '30', '-i', os.path.join(d, 'frames', '%05d.png'),
                '-c:v', 'libx264', '-crf', '12', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-r', '30',
                '-movflags', '+faststart', mp4], check=True)
# verify: decode every frame and count; read the stream's size
p = subprocess.run([FFMPEG, '-v', 'error', '-i', mp4, '-map', '0:v:0', '-f', 'null', '-'], capture_output=True, text=True)
info = subprocess.run([FFMPEG, '-hide_banner', '-i', mp4], capture_output=True, text=True).stderr
cnt = subprocess.run([FFMPEG, '-v', 'error', '-progress', 'pipe:1', '-i', mp4, '-map', '0:v:0', '-f', 'null', '-'], capture_output=True, text=True).stdout
decoded = [int(x) for x in re.findall(r'frame=(\d+)', cnt)]
nframes = decoded[-1] if decoded else -1
m = re.search(r'Video: h264.*?, (\d+)x(\d+)', info)
vw, vh = (int(m.group(1)), int(m.group(2))) if m else (0, 0)
dur = re.search(r'Duration: ([\d:.]+)', info).group(1)
ok = nframes == n and (vw, vh) == (w, h) and p.returncode == 0 and not p.stderr.strip()
# stills: first, 1/3, 2/3, last
idx = {'first': 0, 'third1': round((n - 1) / 3), 'third2': round(2 * (n - 1) / 3), 'last': n - 1}
for k, i in idx.items():
    shutil.copyfile(frames[i], os.path.join(d, f'still-{k}-f{i:03d}.png'))
# contact sheet: one frame per second (0, 30, 60, ...) plus the last frame
picks = list(range(0, n, 30))
if picks[-1] != n - 1:
    picks.append(n - 1)
tw = 480
th = round(tw * h / w)
cols = 4 if len(picks) > 6 else 3
rows = (len(picks) + cols - 1) // cols
pad = 6
sheet = Image.new('RGB', (cols * tw + (cols + 1) * pad, rows * th + (rows + 1) * pad), (24, 24, 24))
dr = ImageDraw.Draw(sheet)
for k, i in enumerate(picks):
    im = Image.open(frames[i]).convert('RGB').resize((tw, th), Image.LANCZOS)
    x = pad + (k % cols) * (tw + pad)
    y = pad + (k // cols) * (th + pad)
    sheet.paste(im, (x, y))
    dr.rectangle([x, y, x + 92, y + 16], fill=(0, 0, 0))
    dr.text((x + 4, y + 3), f'f{i:03d}  {i / 30:.2f}s', fill=(255, 255, 255))
sheet_path = os.path.join(d, f'contact-{name}.jpg')
sheet.save(sheet_path, quality=90)
res = {'mp4': mp4, 'bytes': os.path.getsize(mp4), 'pngFrames': n, 'mp4Frames': nframes, 'size': [vw, vh], 'duration': dur,
       'seconds': n / 30, 'verified': ok, 'stills': idx, 'contactSheet': sheet_path, 'sheetFrames': picks,
       'decodeErrors': p.stderr.strip()[:500]}
json.dump(res, open(os.path.join(d, 'post.json'), 'w'), indent=1)
print(json.dumps(res))
if ok and not keep:
    shutil.rmtree(os.path.join(d, 'frames'))
    print('deleted PNG sequence')
elif not ok:
    print('NOT VERIFIED: keeping frames')
