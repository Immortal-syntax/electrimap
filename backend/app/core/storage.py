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

"""Local filesystem storage abstraction behind a clean interface."""

import hashlib
from pathlib import Path


class LocalStorageService:
    """Manages project files, cached rasters, uploads, and generated DPR exports."""

    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir.resolve()
        for subdir in ("uploads", "projects", "cache", "exports", "reference"):
            (self.base_dir / subdir).mkdir(parents=True, exist_ok=True)

    def resolve_safe_path(self, relative_path: str | Path) -> Path:
        """Resolve a path inside base_dir, preventing path traversal outside base_dir."""
        candidate = (self.base_dir / relative_path).resolve()
        if not candidate.is_relative_to(self.base_dir):
            raise ValueError(f"Unsafe storage path outside base directory: {relative_path}")
        return candidate

    def write_bytes(self, relative_path: str | Path, content: bytes) -> tuple[Path, str]:
        """Write bytes to storage and return (resolved_path, sha256_hex)."""
        target = self.resolve_safe_path(relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        digest = hashlib.sha256(content).hexdigest()
        return target, digest

    def read_bytes(self, relative_path: str | Path) -> bytes:
        """Read bytes from a path inside base_dir."""
        target = self.resolve_safe_path(relative_path)
        return target.read_bytes()

