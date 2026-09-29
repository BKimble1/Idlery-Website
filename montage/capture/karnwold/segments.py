#!/usr/bin/env python3
"""Find hard jumps (e.g. the instant table re-seat when the turn passes) in a captured frame sequence,
so the delivered clip can be trimmed to a cut-free continuous segment. Usage: segments.py <shot> [thresh]"""
import os, re, sys
from PIL import Image, ImageChops, ImageStat
ROOT = os.environ.get('CAPTURE_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))
shot = sys.argv[1]; th = float(sys.argv[2]) if len(sys.argv) > 2 else 1.5
d = f'{ROOT}/frames/{shot}'
fs = sorted(f for f in os.listdir(d) if re.match(r'f\d{5}\.png$', f))
prev = None; cuts = []; diffs = []
for i, f in enumerate(fs):
    im = Image.open(f'{d}/{f}').convert('L').resize((480, 270))
    if prev is not None:
        v = ImageStat.Stat(ImageChops.difference(im, prev)).mean[0]
        diffs.append((i, v))
        if v > th: cuts.append(i)
    prev = im
print('frames', len(fs), 'cuts at', cuts)
print('activity (frame:diff>0.05):', ' '.join(f'{i}:{v:.2f}' for i, v in diffs if v > 0.05))
bounds = [0] + cuts + [len(fs)]
for a, b in zip(bounds, bounds[1:]):
    print(f'segment {a}..{b - 1}  ({(b - a) / 30:.2f} s)')
