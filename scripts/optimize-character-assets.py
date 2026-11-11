"""Generate display-sized WebP variants; retain every original PNG unchanged."""
from pathlib import Path
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
manifest = root / 'src/data/characters.json'
characters = json.loads(manifest.read_text())
rows = []
for character in characters:
    cid = character['id']
    original = root / 'public/assets/characters'
    for name, source, bound, quality in [
        ('portrait', original / f'{cid}.png', 1600, 86),
        ('thumbnail', original / f'{cid}-chibi.png', 256, 84),
        ('artwork', original / f'{cid}-chibi.png', 960, 88),
    ]:
        target = original / f'{cid}-{name}.webp'
        with Image.open(source) as image:
            image = image.convert('RGBA')
            image.thumbnail((bound, bound), Image.Resampling.LANCZOS)
            image.save(target, 'WEBP', quality=quality, method=6)
            character[name] = str(target.relative_to(root / 'public'))
            character[name+'Size'] = {'width': image.width, 'height': image.height}
        rows.append({'file': target.name, 'originalBytes': source.stat().st_size, 'bytes': target.stat().st_size})
manifest.write_text(json.dumps(characters, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(rows, ensure_ascii=False, indent=2))
