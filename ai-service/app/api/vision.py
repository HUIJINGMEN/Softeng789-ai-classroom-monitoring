"""Authenticated internal API; Spring owns consent, identity and persistence."""
import hmac
import json
import os
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

router = APIRouter(prefix='/v2/face')

VISION_ERROR_RESPONSES = {
    401: {'description': 'Missing or invalid internal CV service credential.'},
    413: {'description': 'Image, combined captures, or request body exceeds the size limit.'},
    422: {'description': 'Invalid form, captures, roster, template, or image.'},
    503: {'description': 'CV service key or model configuration is unavailable.'},
}


def authorize(x_cv_service_key: Annotated[str | None, Header()] = None):
    key = os.environ.get('CV_SERVICE_KEY', '')
    if len(key) < 32:
        raise HTTPException(503, 'CV service is disabled until its service key is configured.')
    if not x_cv_service_key or not hmac.compare_digest(key.encode('utf-8'), x_cv_service_key.encode('utf-8')):
        raise HTTPException(401, 'Invalid service credential.')


@lru_cache(maxsize=1)
def engine():
    from app.services.vision import VisionEngine
    return VisionEngine()


def available_engine():
    try:
        return engine()
    except (ImportError, OSError, RuntimeError, ValueError, KeyError) as exc:
        raise HTTPException(503, 'CV models are not installed or configured correctly.') from exc


async def bounded_image(image):
    data = await image.read(7 * 1024 * 1024 + 1)
    if len(data) > 7 * 1024 * 1024:
        raise HTTPException(413, 'Image exceeds 7 MB.')
    return data


@router.post('/enroll', dependencies=[Depends(authorize)], responses=VISION_ERROR_RESPONSES)
async def enroll(poses: Annotated[str, Form()], images: Annotated[list[UploadFile], File()]):
    if len(images) != 7:
        raise HTTPException(422, 'Seven captures required.')
    try:
        labels = json.loads(poses)
        contents = [await bounded_image(image) for image in images]
        if sum(map(len, contents)) > 7 * 1024 * 1024:
            raise HTTPException(413, 'Captures must total at most 7 MB.')
        # Run blocking OpenCV inference outside the ASGI event loop.
        from starlette.concurrency import run_in_threadpool
        return await run_in_threadpool(available_engine().enroll, contents, labels)
    except ValueError as exc:
        raise HTTPException(422, getattr(exc, 'detail', str(exc))) from exc


@router.post('/check-capture', dependencies=[Depends(authorize)], responses=VISION_ERROR_RESPONSES)
async def check_capture(image: Annotated[UploadFile, File()]):
    content = await bounded_image(image)
    from starlette.concurrency import run_in_threadpool
    return await run_in_threadpool(available_engine().check_capture, content)


@router.post('/recognize', dependencies=[Depends(authorize)], responses=VISION_ERROR_RESPONSES)
async def recognize(subjects: Annotated[str, Form()], image: Annotated[UploadFile, File()]):
    try:
        if len(subjects) > 1_500_000:
            raise ValueError('Roster too large.')
        roster = json.loads(subjects)
        if not isinstance(roster, list) or len(roster) > 30:
            raise ValueError('Pilot supports up to 30 registered subjects.')
        service = available_engine()
        from app.services.vision import normalized
        identifiers = set()
        for subject in roster:
            from uuid import UUID
            identifier = str(UUID(subject['studentId']))
            if identifier in identifiers:
                raise ValueError('Duplicate student.')
            identifiers.add(identifier)
            if subject['modelVersion'] != service.version:
                raise ValueError('Model changed. Re-enrollment is required.')
            if not 1 <= len(subject['templates']) <= 7:
                raise ValueError('Invalid template count.')
            for vector in subject['templates']:
                normalized(vector)
        content = await bounded_image(image)
        from starlette.concurrency import run_in_threadpool
        return await run_in_threadpool(service.recognize, content, roster)
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(422, 'Invalid roster, template or image: ' + str(exc)) from exc
