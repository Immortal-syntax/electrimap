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

"""Utility script to apply standard Apache 2.0 license headers to source files."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PY_HEADER = """# Copyright 2026 Swayam Kumar
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

"""

TS_HEADER = """/*
 * Copyright 2026 Swayam Kumar
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"""


def process_python_files() -> int:
    count = 0
    dirs_to_scan = [
        ROOT / "backend" / "app",
        ROOT / "backend" / "tests",
        ROOT / "scripts",
    ]
    for d in dirs_to_scan:
        for p in d.rglob("*.py"):
            text = p.read_text(encoding="utf-8")
            if "Copyright 2026 Swayam Kumar" not in text and "Licensed under the Apache License" not in text:
                p.write_text(PY_HEADER + text, encoding="utf-8")
                count += 1
    return count


def process_ts_files() -> int:
    count = 0
    dirs_to_scan = [
        ROOT / "frontend" / "src",
    ]
    for d in dirs_to_scan:
        for p in list(d.rglob("*.ts")) + list(d.rglob("*.tsx")):
            if p.name.endswith(".d.ts"):
                continue
            text = p.read_text(encoding="utf-8")
            if "Copyright 2026 Swayam Kumar" not in text and "Licensed under the Apache License" not in text:
                p.write_text(TS_HEADER + text, encoding="utf-8")
                count += 1
    return count


def main() -> None:
    py_count = process_python_files()
    ts_count = process_ts_files()
    print(f"Applied license headers: {py_count} Python files, {ts_count} TypeScript/TSX files.")


if __name__ == "__main__":
    main()
