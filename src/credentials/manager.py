"""
Encrypted credential manager.

User credentials for paywalled sources are stored encrypted at-rest using
Fernet symmetric encryption (AES-128-CBC + HMAC-SHA256). Credentials are
never stored or transmitted in plaintext.

Storage is backed by a simple JSON file per user. In production, this should
be replaced by a secrets manager (e.g. AWS Secrets Manager, HashiCorp Vault).
"""
from __future__ import annotations

import base64
import json
import logging
import os
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from config import settings

logger = logging.getLogger(__name__)

_CREDENTIALS_DIR = Path(os.getenv("CREDENTIALS_DIR", "data/credentials"))


def _get_fernet(user_id: str) -> Fernet:
    """
    Derive a per-user Fernet key from the app-level encryption key + user ID.

    This ensures that each user's credentials are encrypted with a distinct
    derived key, limiting blast radius if a single key is exposed.
    """
    if not settings.CREDENTIAL_ENCRYPTION_KEY:
        raise EnvironmentError(
            "CREDENTIAL_ENCRYPTION_KEY is not set. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )

    master_key = settings.CREDENTIAL_ENCRYPTION_KEY.encode()
    salt = user_id.encode()

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
    )
    derived = base64.urlsafe_b64encode(kdf.derive(master_key))
    return Fernet(derived)


def _credentials_path(user_id: str) -> Path:
    _CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    return _CREDENTIALS_DIR / f"{user_id}.enc"


def save_credentials(user_id: str, source_slug: str, username: str, password: str) -> None:
    """
    Persist encrypted credentials for a paywalled source.

    Existing credentials for the same source are overwritten.
    """
    fernet = _get_fernet(user_id)
    path = _credentials_path(user_id)

    # Load existing credentials (if any)
    existing = _load_raw(user_id, fernet)
    existing[source_slug] = {"username": username, "password": password}

    plaintext = json.dumps(existing).encode()
    encrypted = fernet.encrypt(plaintext)
    path.write_bytes(encrypted)
    logger.info("Credentials saved for user=%s source=%s.", user_id, source_slug)


def get_credentials(user_id: str, source_slug: str) -> Optional[dict]:
    """
    Retrieve decrypted credentials for a given source, or None if not found.

    Returns a dict with keys: username, password.
    """
    fernet = _get_fernet(user_id)
    data = _load_raw(user_id, fernet)
    return data.get(source_slug)


def delete_credentials(user_id: str, source_slug: str) -> bool:
    """Remove stored credentials for a source. Returns True if deleted."""
    fernet = _get_fernet(user_id)
    path = _credentials_path(user_id)

    data = _load_raw(user_id, fernet)
    if source_slug not in data:
        return False

    del data[source_slug]
    if data:
        plaintext = json.dumps(data).encode()
        path.write_bytes(fernet.encrypt(plaintext))
    else:
        path.unlink(missing_ok=True)
    logger.info("Credentials deleted for user=%s source=%s.", user_id, source_slug)
    return True


def list_sources(user_id: str) -> list[str]:
    """Return the list of source slugs for which a user has stored credentials."""
    try:
        fernet = _get_fernet(user_id)
        data = _load_raw(user_id, fernet)
        return list(data.keys())
    except Exception:
        return []


def delete_all_credentials(user_id: str) -> None:
    """Remove all stored credentials for a user (GDPR deletion support)."""
    path = _credentials_path(user_id)
    path.unlink(missing_ok=True)
    logger.info("All credentials deleted for user=%s.", user_id)


def _load_raw(user_id: str, fernet: Fernet) -> dict:
    path = _credentials_path(user_id)
    if not path.exists():
        return {}
    try:
        ciphertext = path.read_bytes()
        plaintext = fernet.decrypt(ciphertext)
        return json.loads(plaintext)
    except (InvalidToken, json.JSONDecodeError) as exc:
        logger.error("Failed to decrypt credentials for user=%s: %s", user_id, exc)
        return {}
