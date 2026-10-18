"""Stateless, CPU-only face processing. No images, templates or identities are logged."""
import hashlib
import io
import json
import os
import threading
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

POSES = ['front', 'slight_left', 'left', 'slight_right', 'right', 'chin_up', 'chin_down']
MAX_BYTES = 7 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 25_000_000


def decode_image(content: bytes):
    if not content or len(content) > MAX_BYTES:
        raise ValueError('Use a JPEG or PNG smaller than 7 MB.')
    try:
        with Image.open(io.BytesIO(content)) as image:
            if image.format not in ('JPEG', 'PNG') or image.width * image.height > 25_000_000:
                raise ValueError('Unsupported image or dimensions.')
            rgb = np.array(ImageOps.exif_transpose(image).convert('RGB'))
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except (OSError, Image.DecompressionBombError) as exc:
        raise ValueError('Image cannot be decoded safely.') from exc


def normalized(vector):
    vector = np.asarray(vector, dtype=np.float32).flatten()
    if vector.shape != (128,) or not np.isfinite(vector).all():
        raise ValueError('Invalid face template.')
    length = np.linalg.norm(vector)
    if length < 1e-6:
        raise ValueError('Empty face template.')
    return vector / length


def classify(vector, subjects, threshold, margin):
    scores = []
    for subject in subjects:
        templates = subject['templates']
        if not 1 <= len(templates) <= 7:
            raise ValueError('Invalid template count.')
        score = max(float(np.dot(normalized(vector), normalized(item))) for item in templates)
        scores.append({'studentId': subject['studentId'], 'similarity': round(max(-1., min(1., score)), 5)})
    scores.sort(key=lambda item: (-item['similarity'], item['studentId']))
    if not scores or scores[0]['similarity'] < threshold:
        return 'UNKNOWN', []
    ambiguous = len(scores) > 1 and scores[0]['similarity'] - scores[1]['similarity'] < margin
    return ('UNCERTAIN' if ambiguous else 'MATCH_CANDIDATE'), scores[:3]


class VisionEngine:
    def __init__(self):
        folder = Path(os.environ.get('CV_MODEL_DIR', '../models'))
        manifest = json.loads((folder / 'manifest.json').read_text())
        for item in manifest['models']:
            if hashlib.sha256((folder / item['file']).read_bytes()).hexdigest() != item['sha256']:
                raise RuntimeError('Model checksum mismatch.')
        self.version = manifest['version']
        self.detector = cv2.FaceDetectorYN.create(str(folder / manifest['models'][0]['file']), '', (320, 320), .9)
        self.recognizer = cv2.FaceRecognizerSF.create(str(folder / manifest['models'][1]['file']), '')
        self.lock = threading.Lock()
        cv2.setNumThreads(2)
        self.threshold = float(os.environ.get('CV_MATCH_THRESHOLD', '.5'))
        self.margin = float(os.environ.get('CV_MATCH_MARGIN', '.08'))
        if not 0 < self.threshold < 1 or not 0 < self.margin < 1:
            raise RuntimeError('Invalid matching thresholds.')
        self.threshold_version = f'uncalibrated-pilot:{self.threshold}:{self.margin}'

    def faces(self, image):
        # Bound DNN work, preserving coordinates in the image shown to the teacher.
        scale = min(1., 1600 / max(image.shape[:2]))
        sample = cv2.resize(image, None, fx=scale, fy=scale) if scale < 1 else image
        self.detector.setInputSize((sample.shape[1], sample.shape[0]))
        _, faces = self.detector.detect(sample)
        if faces is None:
            return []
        if len(faces) > 30:
            raise ValueError('More than 30 faces. Photograph smaller groups.')
        faces[:, :14] /= scale
        return sorted(faces, key=lambda face: (float(face[0]), float(face[1])))

    def quality(self, image, face):
        x, y, w, h = [int(v) for v in face[:4]]
        crop = image[max(y, 0):min(y+h, image.shape[0]), max(x, 0):min(x+w, image.shape[1])]
        reasons = []
        if min(w, h) < 80 or crop.size == 0:
            return ['FACE_TOO_SMALL']
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        if cv2.Laplacian(gray, cv2.CV_64F).var() < 35:
            reasons.append('BLUR')
        if not 35 < float(gray.mean()) < 225:
            reasons.append('LIGHTING')
        return reasons

    def embedding(self, image, face):
        return normalized(self.recognizer.feature(self.recognizer.alignCrop(image, face)))

    def enroll(self, contents, poses):
        if poses != POSES or len(contents) != 7:
            raise ValueError('Seven ordered pose captures are required.')
        with self.lock:
            templates = []
            for content in contents:
                image = decode_image(content)
                faces = self.faces(image)
                if len(faces) != 1:
                    raise ValueError('Each capture must contain exactly one face.')
                reasons = self.quality(image, faces[0])
                if reasons:
                    raise ValueError('Retake capture: ' + ', '.join(reasons))
                vector = self.embedding(image, faces[0])
                if templates and float(np.dot(vector, templates[0])) < self.threshold:
                    raise ValueError('Captures are not consistent with the front face. Retake them.')
                templates.append(vector)
            return {'templates': [v.tolist() for v in templates], 'modelVersion': self.version,
                    'qualityPassed': True, 'padStatus': 'NOT_PERFORMED', 'poseStatus': 'TEACHER_REVIEW_REQUIRED'}

    def recognize(self, content, subjects):
        with self.lock:
            image = decode_image(content)
            results = []
            for i, face in enumerate(self.faces(image)):
                reasons = self.quality(image, face)
                decision, candidates = ('LOW_QUALITY', []) if reasons else classify(
                    self.embedding(image, face), subjects, self.threshold, self.margin)
                height, width = image.shape[:2]
                x, y, w, h = [float(v) for v in face[:4]]
                left, top = min(1., max(0., x / width)), min(1., max(0., y / height))
                results.append({'faceId': f'f{i+1}', 'box': {'x': left, 'y': top,
                    'width': max(0., min(1., (x+w)/width)-left), 'height': max(0., min(1., (y+h)/height)-top)},
                    'decision': decision, 'qualityReasons': reasons, 'candidates': candidates})
            winners = [r['candidates'][0]['studentId'] for r in results if r['candidates']]
            for result in results:
                if result['candidates'] and winners.count(result['candidates'][0]['studentId']) > 1:
                    result['decision'] = 'UNCERTAIN'
                    result['qualityReasons'].append('DUPLICATE_IDENTITY')
            return {'faces': results, 'modelVersion': self.version, 'thresholdVersion': self.threshold_version}
