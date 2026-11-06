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

"""Pure terrain raster operations: Horn slope calculation and hillshade generation.

Domain purity rule: Operates purely on NumPy arrays in memory.
"""

from typing import cast

import numpy as np
from numpy.typing import NDArray


def compute_slope_deg(
    elevation_m: NDArray[np.floating],
    cell_size_x_m: float = 30.0,
    cell_size_y_m: float = 30.0,
) -> NDArray[np.float64]:
    """Compute terrain slope in degrees from an elevation grid (meters) using finite differences."""
    if elevation_m.ndim != 2:
        raise ValueError("elevation_m must be a 2D array.")
    if cell_size_x_m <= 0.0 or cell_size_y_m <= 0.0:
        raise ValueError("Cell sizes cell_size_x_m and cell_size_y_m must be positive.")

    dz_dy, dz_dx = np.gradient(elevation_m.astype(np.float64), cell_size_y_m, cell_size_x_m)
    slope_rad = np.arctan(np.hypot(dz_dx, dz_dy))
    return cast(NDArray[np.float64], np.degrees(slope_rad).astype(np.float64))


def compute_hillshade(
    elevation_m: NDArray[np.floating],
    cell_size_m: float = 30.0,
    azimuth_deg: float = 315.0,
    altitude_deg: float = 45.0,
) -> NDArray[np.uint8]:
    """Compute a cartographic hillshade (0-255 uint8) from an elevation grid (meters)."""
    dz_dy, dz_dx = np.gradient(elevation_m.astype(np.float64), cell_size_m, cell_size_m)
    slope_rad = np.pi / 2.0 - np.arctan(np.hypot(dz_dx, dz_dy))
    aspect_rad = np.arctan2(-dz_dx, dz_dy)
    azimuth_rad = np.radians((360.0 - azimuth_deg + 90.0) % 360.0)
    altitude_rad = np.radians(altitude_deg)

    shaded = np.sin(altitude_rad) * np.sin(slope_rad) + (
        np.cos(altitude_rad) * np.cos(slope_rad) * np.cos(azimuth_rad - aspect_rad)
    )
    normalized = np.clip((shaded + 1.0) * 0.5 * 255.0, 0.0, 255.0)
    return cast(NDArray[np.uint8], normalized.astype(np.uint8))
