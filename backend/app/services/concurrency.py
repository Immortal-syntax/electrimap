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

"""Per-project concurrency guards for lazy seeding and scenario generation.

Prevents race conditions when the frontend fires concurrent GET requests
(`/scenarios`, `/rates`, `/comparison`, `/report/preflight`, `/gap-analysis`,
`/demand`, `/settings`) on a newly created project.
"""

import hashlib
import threading
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import text
from sqlalchemy.orm import Session


class _LockThreadState(threading.local):
    depths: dict[str, int]

    def __init__(self) -> None:
        self.depths = {}


_REGISTRY_GUARD = threading.Lock()
_KEYED_LOCKS: dict[str, threading.RLock] = {}
_LOCAL_STATE = _LockThreadState()


def _get_lock(key: str) -> threading.RLock:
    with _REGISTRY_GUARD:
        lock = _KEYED_LOCKS.get(key)
        if lock is None:
            lock = threading.RLock()
            _KEYED_LOCKS[key] = lock
        return lock


def acquire_pg_xact_lock(db: Session, lock_name: str) -> None:
    """Acquire a transaction-scoped PostgreSQL advisory lock when running against Postgres."""
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return
    digest = hashlib.blake2b(lock_name.encode("utf-8"), digest_size=8).digest()
    lock_key = int.from_bytes(digest, byteorder="big", signed=True)
    db.execute(text("SELECT pg_advisory_xact_lock(:lock_key)"), {"lock_key": lock_key})


@contextmanager
def keyed_lock(key: str) -> Iterator[bool]:
    """Acquire a re-entrant in-process mutex for `key`, yielding True on outermost entry."""
    lock = _get_lock(key)
    depths = _LOCAL_STATE.depths
    prior_depth = depths.get(key, 0)
    is_outermost = prior_depth == 0
    with lock:
        depths[key] = prior_depth + 1
        try:
            yield is_outermost
        finally:
            if prior_depth == 0:
                depths.pop(key, None)
            else:
                depths[key] = prior_depth


@contextmanager
def project_lock(db: Session, project_id: str) -> Iterator[None]:
    """Serialize lazy project seeding and scenario calculation per `project_id`."""
    lock_key = f"project:{project_id}"
    with keyed_lock(lock_key) as is_outermost:
        if is_outermost:
            if not db.new and not db.dirty and not db.deleted:
                if db.in_transaction():
                    db.rollback()
                db.expire_all()
            acquire_pg_xact_lock(db, lock_key)
        yield
