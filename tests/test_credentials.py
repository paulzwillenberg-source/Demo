"""Tests for the encrypted credential manager."""
import os
import tempfile

import pytest
from cryptography.fernet import Fernet

from src.credentials.manager import (
    delete_all_credentials,
    delete_credentials,
    get_credentials,
    list_sources,
    save_credentials,
)


@pytest.fixture(autouse=True)
def temp_credentials_dir(monkeypatch, tmp_path):
    """Redirect credential storage to a temporary directory."""
    import src.credentials.manager as mgr
    monkeypatch.setattr(mgr, "_CREDENTIALS_DIR", tmp_path)

    # Set a real encryption key for tests
    key = Fernet.generate_key().decode()
    monkeypatch.setattr("src.credentials.manager.settings.CREDENTIAL_ENCRYPTION_KEY", key)
    return tmp_path


class TestCredentialManager:
    USER_ID = "user-test-001"

    def test_save_and_retrieve(self):
        save_credentials(self.USER_ID, "nytimes", "john@example.com", "s3cr3t!")
        creds = get_credentials(self.USER_ID, "nytimes")
        assert creds is not None
        assert creds["username"] == "john@example.com"
        assert creds["password"] == "s3cr3t!"

    def test_retrieve_nonexistent_returns_none(self):
        result = get_credentials(self.USER_ID, "nonexistent_source")
        assert result is None

    def test_overwrite_existing_credentials(self):
        save_credentials(self.USER_ID, "wsj", "old@example.com", "oldpass")
        save_credentials(self.USER_ID, "wsj", "new@example.com", "newpass")
        creds = get_credentials(self.USER_ID, "wsj")
        assert creds["username"] == "new@example.com"
        assert creds["password"] == "newpass"

    def test_multiple_sources(self):
        save_credentials(self.USER_ID, "nytimes", "user@example.com", "pass1")
        save_credentials(self.USER_ID, "wsj", "user@example.com", "pass2")

        nyt = get_credentials(self.USER_ID, "nytimes")
        wsj = get_credentials(self.USER_ID, "wsj")

        assert nyt["password"] == "pass1"
        assert wsj["password"] == "pass2"

    def test_list_sources(self):
        save_credentials(self.USER_ID, "ft", "u@e.com", "p1")
        save_credentials(self.USER_ID, "bloomberg", "u@e.com", "p2")
        sources = list_sources(self.USER_ID)
        assert "ft" in sources
        assert "bloomberg" in sources

    def test_delete_credentials(self):
        save_credentials(self.USER_ID, "theatlantic", "u@e.com", "pass")
        result = delete_credentials(self.USER_ID, "theatlantic")
        assert result is True
        assert get_credentials(self.USER_ID, "theatlantic") is None

    def test_delete_nonexistent_returns_false(self):
        result = delete_credentials(self.USER_ID, "nonexistent")
        assert result is False

    def test_delete_all_credentials(self):
        save_credentials(self.USER_ID, "nytimes", "u@e.com", "p")
        save_credentials(self.USER_ID, "wsj", "u@e.com", "p2")
        delete_all_credentials(self.USER_ID)
        assert list_sources(self.USER_ID) == []

    def test_credentials_stored_encrypted(self, tmp_path):
        save_credentials(self.USER_ID, "nytimes", "secret@example.com", "supersecret")
        enc_file = tmp_path / f"{self.USER_ID}.enc"
        raw_bytes = enc_file.read_bytes()
        # Plaintext credentials must not appear in the encrypted file
        assert b"secret@example.com" not in raw_bytes
        assert b"supersecret" not in raw_bytes
