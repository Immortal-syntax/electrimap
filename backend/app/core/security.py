# Copyright 2026 Swayam Kumar
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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
    return _ph.hash(plain_password)


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


def derive_session_csrf_token(session_token_hash: str, session_secret: str) -> str:
    """Derive a deterministic CSRF token bound to a session digest and server secret."""
    return hmac.new(
        session_secret.encode("utf-8"),
        f"electrimap-csrf-v1:{session_token_hash}".encode(),
        hashlib.sha256,
    ).hexdigest()


class LoginRateLimiter:
    """Sliding-window rate limiter enforcing both per-(ip, email) and per-IP caps."""

    def __init__(
        self,
        max_attempts: int = 8,
        window_seconds: int = 60,
        max_ip_attempts: int = 24,
        max_tracked_keys: int = 2048,
    ) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.max_ip_attempts = max_ip_attempts
        self.max_tracked_keys = max_tracked_keys
        self._attempts: dict[str, list[float]] = defaultdict(list)

    def _evict_expired(self, cutoff: float) -> None:
        if len(self._attempts) < self.max_tracked_keys:
            return
        stale_keys = [
            key
            for key, timestamps in self._attempts.items()
            if not any(ts > cutoff for ts in timestamps)
        ]
        for key in stale_keys:
            del self._attempts[key]

    def _record_key(self, key: str, limit: int, now: float, cutoff: float) -> None:
        recent = [ts for ts in self._attempts[key] if ts > cutoff]
        if len(recent) >= limit:
            self._attempts[key] = recent
            raise RateLimitExceededError(retry_after_seconds=self.window_seconds)
        recent.append(now)
        self._attempts[key] = recent

    def check_and_record(self, key: str) -> None:
        """Raise RateLimitExceededError if key exceeds max_attempts within window_seconds."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        self._evict_expired(cutoff)
        self._record_key(key, self.max_attempts, now, cutoff)

    def check_login_attempt(self, ip_address: str, email: str) -> None:
        """Check and record both per-(ip, email) and aggregate per-IP attempt limits."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        self._evict_expired(cutoff)
        ip_key = f"ip:{ip_address}"
        account_key = f"{ip_address}:{email}"
        self._record_key(ip_key, self.max_ip_attempts, now, cutoff)
        self._record_key(account_key, self.max_attempts, now, cutoff)

    def reset(self, key: str) -> None:
        """Clear recorded attempts for a key after a successful authentication."""
        self._attempts.pop(key, None)

    def reset_login_attempt(self, ip_address: str, email: str) -> None:
        """Clear failed attempts for (ip, email) and refund one IP attempt on valid sign-in."""
        self._attempts.pop(f"{ip_address}:{email}", None)
        ip_events = self._attempts.get(f"ip:{ip_address}")
        if ip_events:
            ip_events.pop()


login_rate_limiter = LoginRateLimiter()
