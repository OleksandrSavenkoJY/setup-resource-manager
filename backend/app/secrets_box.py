import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

log = logging.getLogger("secrets_box")
PREFIX = "enc1:"

_raw = os.getenv("APP_SECRET_KEY", "").strip()
_fernet = Fernet(base64.urlsafe_b64encode(hashlib.sha256(_raw.encode()).digest())) if _raw else None
if _fernet is None:
    log.warning("APP_SECRET_KEY is not set: stored access point passwords are NOT encrypted")


def encrypt(value: str) -> str:
    if not value or _fernet is None or value.startswith(PREFIX):
        return value
    return PREFIX + _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    if not value or not value.startswith(PREFIX):
        return value  # legacy plain text
    if _fernet is None:
        log.error("Encrypted value found but APP_SECRET_KEY is not set")
        return ""
    try:
        return _fernet.decrypt(value[len(PREFIX):].encode()).decode()
    except InvalidToken:
        log.error("Could not decrypt a stored value: APP_SECRET_KEY changed?")
        return ""


class EncryptedText(TypeDecorator):
    """Text column whose content is encrypted at rest when APP_SECRET_KEY is set."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt(value) if value is not None else value

    def process_result_value(self, value, dialect):
        return decrypt(value) if value is not None else value
