import io
import json
import os
from pathlib import Path
import threading
import unittest
from unittest.mock import patch
from uuid import uuid4

import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.services.vision import VisionEngine, classify, decode_image, normalized, POSES


def photo(width=320, height=240):
    output = io.BytesIO()
    Image.new('RGB', (width, height), (100, 120, 140)).save(output, format='PNG')
    return output.getvalue()


def vector(index=0):
    result = np.zeros(128, dtype=np.float32); result[index] = 1
    return result.tolist()


class VisionTests(unittest.TestCase):
    def test_unknown_and_ambiguous_are_not_forced_matches(self):
        subjects = [{'studentId': 'a', 'templates': [vector(0)]}]
        self.assertEqual(classify(vector(1), subjects, .5, .08), ('UNKNOWN', []))
        self.assertEqual(classify(vector(0), subjects, .5, .08)[0], 'MATCH_CANDIDATE')
        subjects.append({'studentId': 'b', 'templates': [vector(0)]})
        self.assertEqual(classify(vector(0), subjects, .5, .08)[0], 'UNCERTAIN')

    def test_invalid_embeddings_are_rejected(self):
        for item in [[0] * 128, [1, 2], [float('nan')] * 128, [float('inf')] * 128]:
            with self.assertRaises(ValueError): normalized(item)

    def test_image_validation_and_exif_orientation(self):
        self.assertEqual(decode_image(photo()).shape, (240, 320, 3))
        for invalid in [b'not an image', b'', b'x' * (7 * 1024 * 1024 + 1)]:
            with self.assertRaises(ValueError): decode_image(invalid)
        out = io.BytesIO(); exif = Image.Exif(); exif[274] = 6
        Image.new('RGB', (30, 20)).save(out, format='JPEG', exif=exif)
        self.assertEqual(decode_image(out.getvalue()).shape, (30, 20, 3))

    def fake_engine(self):
        engine = VisionEngine.__new__(VisionEngine); engine.lock = threading.Lock()
        engine.threshold = .5; engine.margin = .08; engine.version = 'test'; engine.threshold_version = 'test:.5:.08'
        return engine

    def test_duplicate_matches_need_teacher_review(self):
        engine = self.fake_engine()
        with patch.object(engine, 'faces', return_value=[np.array([10, 10, 100, 100]), np.array([150, 10, 100, 100])]), \
                patch.object(engine, 'quality', return_value=[]), patch.object(engine, 'embedding', return_value=np.array(vector())):
            result = engine.recognize(photo(), [{'studentId': 'a', 'templates': [vector()]}])
        self.assertEqual([f['decision'] for f in result['faces']], ['UNCERTAIN', 'UNCERTAIN'])
        self.assertTrue(all('DUPLICATE_IDENTITY' in f['qualityReasons'] for f in result['faces']))

    def test_quality_failure_never_produces_candidates(self):
        engine = self.fake_engine()
        with patch.object(engine, 'faces', return_value=[np.array([10, 10, 10, 10])]):
            result = engine.recognize(photo(), [{'studentId': 'a', 'templates': [vector()]}])
        self.assertEqual(result['faces'][0]['decision'], 'LOW_QUALITY')
        self.assertEqual(result['faces'][0]['candidates'], [])

    def test_enrollment_rejects_missing_or_multiple_faces_and_inconsistent_identity(self):
        engine = self.fake_engine(); image = photo()
        with self.assertRaises(ValueError): engine.enroll([image], ['front'])
        for faces in [[], [np.zeros(15), np.zeros(15)]]:
            with patch.object(engine, 'faces', return_value=faces), self.assertRaises(ValueError):
                engine.enroll([image] * 7, POSES)
        with patch.object(engine, 'faces', return_value=[np.zeros(15)]), patch.object(engine, 'quality', return_value=[]), \
                patch.object(engine, 'embedding', side_effect=[np.array(vector(0)), np.array(vector(1))]), self.assertRaises(ValueError):
            engine.enroll([image] * 7, POSES)

    def test_enrollment_error_reports_first_failed_capture_and_safe_reasons(self):
        engine = self.fake_engine()
        for reasons in [['BLUR'], ['LIGHTING'], ['FACE_TOO_SMALL'], ['BLUR', 'LIGHTING']]:
            with self.subTest(reasons=reasons), patch.dict(os.environ, {'CV_SERVICE_KEY': 't' * 32}), TestClient(app) as client, \
                    patch('app.api.vision.available_engine', return_value=engine), \
                    patch.object(engine, 'faces', return_value=[np.zeros(15)]), \
                    patch.object(engine, 'quality', side_effect=[[], [], reasons]), \
                    patch.object(engine, 'embedding', return_value=np.array(vector())):
                response = client.post('/v2/face/enroll', headers={'X-CV-Service-Key': 't' * 32},
                    data={'poses': json.dumps(POSES)},
                    files=[('images', (f'{i}.png', photo(), 'image/png')) for i in range(7)])
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json(), {'detail': {'code': 'ENROLLMENT_CAPTURE_REJECTED',
                    'captureNumber': 3, 'reasons': reasons}})
                self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_enrollment_face_count_identity_and_decode_diagnostics(self):
        engine = self.fake_engine()
        for faces, code in [([], 'NO_FACE'), ([np.zeros(15), np.zeros(15)], 'MULTIPLE_FACES')]:
            with patch.object(engine, 'faces', return_value=faces), self.assertRaises(ValueError) as error:
                engine.enroll([photo()] * 7, POSES)
            self.assertEqual(error.exception.detail['captureNumber'], 1)
            self.assertEqual(error.exception.detail['reasons'], [code])
        with patch.object(engine, 'faces', return_value=[np.zeros(15)]), patch.object(engine, 'quality', return_value=[]), \
                patch.object(engine, 'embedding', side_effect=[np.array(vector(0)), np.array(vector(1))]), self.assertRaises(ValueError) as error:
            engine.enroll([photo()] * 7, POSES)
        self.assertEqual(error.exception.detail, {'code': 'ENROLLMENT_CAPTURE_REJECTED',
            'captureNumber': 2, 'reasons': ['INCONSISTENT_IDENTITY']})
        with self.assertRaises(ValueError) as error:
            engine.enroll([b'invalid-private-content'] * 7, POSES)
        self.assertEqual(error.exception.detail['reasons'], ['INVALID_IMAGE'])
        self.assertNotIn('invalid-private-content', str(error.exception))

    def test_successful_enrollment_does_not_claim_liveness_or_automatic_pose_checks(self):
        engine = self.fake_engine()
        with patch.object(engine, 'faces', return_value=[np.zeros(15)]), patch.object(engine, 'quality', return_value=[]), \
                patch.object(engine, 'embedding', return_value=np.array(vector())):
            result = engine.enroll([photo()] * 7, POSES)
        self.assertEqual(len(result['templates']), 7)
        self.assertEqual(result['padStatus'], 'NOT_PERFORMED')
        self.assertEqual(result['poseStatus'], 'TEACHER_REVIEW_REQUIRED')

    def test_api_auth_size_and_malformed_roster(self):
        with patch.dict(os.environ, {'CV_SERVICE_KEY': 't' * 32}), TestClient(app) as client:
            self.assertEqual(client.post('/v2/face/recognize').status_code, 401)
            # The legacy adapter credential never authorizes the CV protocol.
            self.assertEqual(client.post('/v2/face/recognize', headers={'X-AI-Adapter-Key': 'test-only-secret'}).status_code, 401)
            headers = {'X-CV-Service-Key': 't' * 32}
            self.assertEqual(client.post('/v2/face/recognize', headers=headers, content=b'x' * (9 * 1024 * 1024 + 1)).status_code, 413)
            self.assertEqual(client.post('/v2/face/recognize', headers=headers, data={'subjects': 'not-json'}, files={'image': ('test.png', photo(), 'image/png')}).status_code, 422)
            with patch('app.api.vision.available_engine', return_value=self.fake_engine()):
                roster = [{'studentId': str(uuid4()), 'modelVersion': 'test', 'templates': [[0] * 128]}]
                self.assertEqual(client.post('/v2/face/recognize', headers=headers, data={'subjects': json.dumps(roster)}, files={'image': ('test.png', photo(), 'image/png')}).status_code, 422)

    def test_real_pinned_models_load_and_no_face_smoke(self):
        folder = Path(__file__).resolve().parents[2] / 'models'
        if not (folder / 'manifest.json').exists(): self.skipTest('Run scripts/install_cv_models.py for real-model smoke testing.')
        with patch.dict(os.environ, {'CV_MODEL_DIR': str(folder)}):
            engine = VisionEngine()
            self.assertEqual(engine.recognize(photo(), [])['faces'], [])
            with self.assertRaises(ValueError): engine.enroll([photo()] * 7, POSES)

    def test_successful_api_contract_with_synthetic_inference(self):
        engine = self.fake_engine()
        with patch.dict(os.environ, {'CV_SERVICE_KEY': 't' * 32}), TestClient(app) as client, \
                patch('app.api.vision.available_engine', return_value=engine), \
                patch.object(engine, 'faces', return_value=[np.array([10, 10, 100, 100])]), \
                patch.object(engine, 'quality', return_value=[]), patch.object(engine, 'embedding', return_value=np.array(vector())):
            headers = {'X-CV-Service-Key': 't' * 32}
            enrollment = client.post('/v2/face/enroll', headers=headers, data={'poses': json.dumps(POSES)},
                files=[('images', (f'{i}.png', photo(), 'image/png')) for i in range(7)])
            self.assertEqual(enrollment.status_code, 200)
            subject_id = str(uuid4())
            subjects = [{'studentId': subject_id, 'modelVersion': 'test', 'templates': enrollment.json()['templates']}]
            result = client.post('/v2/face/recognize', headers=headers, data={'subjects': json.dumps(subjects)}, files={'image': ('group.png', photo(), 'image/png')})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.headers['cache-control'], 'no-store')
            self.assertEqual(result.json()['faces'][0]['candidates'][0]['studentId'], subject_id)


if __name__ == '__main__': unittest.main()
