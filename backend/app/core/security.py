"""Cryptographic helpers: Argon2id hashing, session/CSRF token hashing, and rate limiting."""

import hashlib
import hmac
import secrets
import time
from collections import defaultdict

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.errors import RateLimitExceededError

_ph = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=2)
_DUMMY_PASSWORD_HASH = _ph.hash("electrimap-constant-time-dummy-password")


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return str(_ph.hash(plain_password))


def verify_password(plain_password: str, password_hash: str | None) -> bool:
    """Verify a plaintext password against an Argon2id hash in constant-like time."""
    target_hash = password_hash if password_hash is not None else _DUMMY_PASSWORD_HASH
    try:
        matched = bool(_ph.verify(target_hash, plain_password))
        return matched if password_hash is not None else False
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def generate_secure_token(nbytes: int = 32) -> str:
    """Generate a cryptographically random URL-safe token (default 256 bits)."""
    return secrets.token_urlsafe(nbytes)


def hash_token(raw_token: str) -> str:
    """Return hex SHA-256 digest of a session or CSRF token for storage at rest."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def verify_token_hash(raw_token: str, expected_hash: str) -> bool:
    """Constant-time comparison between a raw token's SHA-256 digest and stored hash."""
    computed = hash_token(raw_token)
    return hmac.compare_digest(computed, expected_hash)


class LoginRateLimiter:
    """Sliding-window rate limiter keyed by (ip_address, email) to prevent brute-force logins."""

    def __init__(self, max_attempts: int = 8, window_seconds: int = 60) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)

    def check_and_record(self, key: str) -> None:
        """Raise RateLimitExceededError if key exceeds max_attempts within window_seconds."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        recent = [ts for ts in self._attempts[key] if ts > cutoff]
        if len(recent) >= self.max_attempts:
            self._attempts[key] = recent
            raise RateLimitExceededError(retry_after_seconds=self.window_seconds)
        recent.append(now)
        self._attempts[key] = recent

    def reset(self, key: str) -> None:
        """Clear recorded attempts for a key after a successful authentication."""
        self._attempts.pop(key, None)


login_rate_limiter = LoginRateLimiter()
