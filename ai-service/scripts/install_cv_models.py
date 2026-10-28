"""Download pinned OpenCV Zoo weights with checksum verification and license notices."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
MODEL_ROOT = ROOT.parent / 'models'

def confined_path(base, value):
    base = base.resolve()
    target = (base / value).resolve()
    if not target.is_relative_to(base):
        raise ValueError('Model output must stay within the repository models directory.')
    return target

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=MODEL_ROOT)
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'models-manifest.json').read_text())
    if MODEL_ROOT.is_symlink():
        raise ValueError('The model directory must not be a symlink.')
    output = confined_path(MODEL_ROOT, args.output)
    output.mkdir(parents=True, exist_ok=True)
    commit = manifest['sourceCommit']
    for item in manifest['models']:
        target = confined_path(output, item['file'])
        if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != item['sha256']:
            with urlopen(f"https://media.githubusercontent.com/media/opencv/opencv_zoo/{commit}/{item['path']}", timeout=120) as response:
                content = response.read()
            if hashlib.sha256(content).hexdigest() != item['sha256']:
                raise RuntimeError(f"Checksum mismatch: {item['file']}")
            target.write_bytes(content)
        with urlopen(f"https://raw.githubusercontent.com/opencv/opencv_zoo/{commit}/{item['licensePath']}", timeout=30) as response:
            confined_path(output, item['file'] + '.LICENSE').write_bytes(response.read())
        print('Verified', item['file'])
    confined_path(output, 'manifest.json').write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
