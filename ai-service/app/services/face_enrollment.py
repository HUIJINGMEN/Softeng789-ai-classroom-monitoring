import imghdr

SUPPORTED_IMAGE_TYPES = {"jpeg", "png", "gif", "bmp", "webp"}


def validate_image_bytes(content: bytes) -> bool:
    if not content:
        return False
    return imghdr.what(None, h=content) in SUPPORTED_IMAGE_TYPES
