#!/usr/bin/env python3
"""Encode a captured frame sequence -> MP4 (libx264 crf 12, slow, yuv420p, 30 fps, +faststart),
export first/middle/last PNG stills and a labelled contact sheet (one frame per ~0.5 s).
Usage: finish.py <shot> [first_frame] [last_frame]   (frame range optional, inclusive)"""
import os, re, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.environ.get('CAPTURE_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))
FPS = 30
shot = sys.argv[1]
src = f'{ROOT}/frames/{shot}'
frames = sorted(f for f in os.listdir(src) if re.match(r'f\d{5}\.png$', f))
lo = int(sys.argv[2]) if len(sys.argv) > 2 else 0
hi = int(sys.argv[3]) if len(sys.argv) > 3 else len(frames) - 1
frames = frames[lo:hi + 1]
# renumber into a clean sequence for ffmpeg
seq = f'{ROOT}/frames/_{shot}_seq'
shutil.rmtree(seq, ignore_errors=True); os.makedirs(seq)
for i, f in enumerate(frames):
    os.link(f'{src}/{f}', f'{seq}/s{i:05d}.png')

out_mp4 = f'{ROOT}/{shot}.mp4'
cmd = ['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', f'{seq}/s%05d.png',
       '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
       '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', str(FPS),
       '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
       '-movflags', '+faststart', out_mp4]
subprocess.run(cmd, check=True)

# stills
n = len(frames)
for tag, idx in (('first', 0), ('mid', n // 2), ('last', n - 1)):
    shutil.copyfile(f'{seq}/s{idx:05d}.png', f'{ROOT}/{shot}_{tag}.png')

# contact sheet: one frame every 15 frames (0.5 s), 480 px wide tiles, 5 per row, timecode labels
step = FPS // 2
picks = list(range(0, n, step))
tw, th = 480, 270
cols = 5
rows = (len(picks) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 22)), (18, 14, 10))
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
d = ImageDraw.Draw(sheet)
for k, idx in enumerate(picks):
    im = Image.open(f'{seq}/s{idx:05d}.png').convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (k % cols) * tw, (k // cols) * (th + 22)
    sheet.paste(im, (x, y))
    d.text((x + 6, y + th + 3), f'{idx / FPS:5.2f}s  (frame {idx})', fill=(230, 210, 170), font=font)
sheet.save(f'{ROOT}/{shot}_contact.jpg', quality=88)

# verify the MP4 decodes fully and report frame count / duration
r = subprocess.run(['ffmpeg', '-v', 'error', '-i', out_mp4, '-map', '0:v', '-f', 'null', '-'], capture_output=True, text=True)
info = subprocess.run(['ffmpeg', '-i', out_mp4], capture_output=True, text=True).stderr
dur = re.search(r'Duration: ([\d:.]+)', info).group(1)
stream = re.search(r'Stream #0:0.*', info).group(0)
print(f'{shot}: {n} frames -> {out_mp4}  duration {dur}  decode_errors={r.stderr.strip() or "none"}')
print('  ', stream)
print('  size', os.path.getsize(out_mp4) // 1024, 'KiB')
shutil.rmtree(seq)
