"""
Thin wrapper around Ansible Vault for encrypting/decrypting secrets (SSH keys, passwords).
Uses the vault password file configured in settings.
"""
import subprocess
import tempfile
import os
from pathlib import Path

from core.config import settings


class VaultError(Exception):
    pass


def _vault_password() -> str:
    pwd_file = settings.ANSIBLE_VAULT_PASSWORD_FILE
    if os.path.isfile(pwd_file):
        return Path(pwd_file).read_text().strip()
    # Fallback: use SECRET_KEY (dev only)
    return settings.SECRET_KEY


def encrypt_string(plaintext: str, var_name: str = "secret") -> str:
    """Encrypt a string using ansible-vault encrypt_string."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".pwd", delete=False) as pwf:
        pwf.write(_vault_password())
        pwf_path = pwf.name

    try:
        result = subprocess.run(
            [
                "ansible-vault",
                "encrypt_string",
                "--vault-password-file",
                pwf_path,
                "--stdin-name",
                var_name,
            ],
            input=plaintext,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        raise VaultError(f"ansible-vault encrypt_string failed: {e.stderr}") from e
    finally:
        os.unlink(pwf_path)


def decrypt_file(vault_file: str) -> str:
    """Decrypt an ansible-vault encrypted file and return its content."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".pwd", delete=False) as pwf:
        pwf.write(_vault_password())
        pwf_path = pwf.name

    try:
        result = subprocess.run(
            [
                "ansible-vault",
                "decrypt",
                "--vault-password-file",
                pwf_path,
                "--output",
                "-",
                vault_file,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        raise VaultError(f"ansible-vault decrypt failed: {e.stderr}") from e
    finally:
        os.unlink(pwf_path)


def encrypt_file(content: str, dest_path: str) -> None:
    """Write content to dest_path and encrypt it with ansible-vault."""
    Path(dest_path).write_text(content)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".pwd", delete=False) as pwf:
        pwf.write(_vault_password())
        pwf_path = pwf.name

    try:
        subprocess.run(
            [
                "ansible-vault",
                "encrypt",
                "--vault-password-file",
                pwf_path,
                dest_path,
            ],
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as e:
        raise VaultError(f"ansible-vault encrypt failed: {e.stderr}") from e
    finally:
        os.unlink(pwf_path)
