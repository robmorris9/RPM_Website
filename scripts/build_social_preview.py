"""Render the site's typographic social card. Optional: Python 3 + Pillow."""
from pathlib import Path
import json
import re
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
profile = json.loads((root / 'content/profile.json').read_text())
css = (root / 'src/styles.css').read_text()
color = lambda name: re.search(r'--' + name + r': (#[0-9a-fA-F]{6});', css).group(1)
font = lambda size, weight='Regular': ImageFont.truetype(str(root / f'assets/fonts/IBMPlexSans-{weight}.ttf'), size)
image = Image.new('RGB', (1200, 630), color('paper'))
draw = ImageDraw.Draw(image)
draw.text((88, 166), profile['name'], font=font(92, 'Medium'), fill=color('heading'))
parts = profile['headline'].split(' · ')
for y, line in [(306, ' · '.join(parts[:2])), (355, ' · '.join(parts[2:]))]:
    draw.text((92, y), line, font=font(30), fill=color('accent'))
draw.line((92, 474, 1108, 474), fill=color('rule'), width=2)
draw.text((92, 506), profile['url'].removeprefix('https://').rstrip('/'), font=font(25), fill=color('muted'))
image.save(root / 'og-image.png', optimize=True)
print('Rendered og-image.png (1200 × 630).')
