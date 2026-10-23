"""Download pinned OpenCV Zoo weights with checksum verification and license notices."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=root.parent / 'models')
args = parser.parse_args()
manifest = json.loads((root / 'models-manifest.json').read_text())
args.output.mkdir(parents=True, exist_ok=True)
commit = manifest['sourceCommit']
for item in manifest['models']:
    target = args.output / item['file']
    if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != item['sha256']:
        with urlopen(f"https://media.githubusercontent.com/media/opencv/opencv_zoo/{commit}/{item['path']}", timeout=120) as response:
            content = response.read()
        if hashlib.sha256(content).hexdigest() != item['sha256']:
            raise RuntimeError(f"Checksum mismatch: {item['file']}")
        target.write_bytes(content)
    with urlopen(f"https://raw.githubusercontent.com/opencv/opencv_zoo/{commit}/{item['licensePath']}", timeout=30) as response:
        (args.output / (item['file'] + '.LICENSE')).write_bytes(response.read())
    print('Verified', item['file'])
(args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2))
