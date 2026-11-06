"""Typed application errors and standard REST error envelope handlers."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base typed exception mapped to the standard REST error envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class AoiTooLargeError(AppError):
    """Raised when an Area of Interest exceeds the configured area cap."""

    def __init__(self, area_km2: float, max_aoi_km2: float) -> None:
        super().__init__(
            code="AOI_TOO_LARGE",
            message=(
                f"AOI area ({area_km2:.2f} km^2) exceeds the maximum allowed limit "
                f"of {max_aoi_km2:.2f} km^2."
            ),
            status_code=422,
            details={"area_km2": round(area_km2, 3), "max_aoi_km2": max_aoi_km2},
        )


class InvalidGeometryError(AppError):
    """Raised when uploaded or drawn geometry is invalid or outside India."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            code="INVALID_GEOMETRY",
            message=message,
            status_code=422,
            details=details,
        )


class SourceUnavailableError(AppError):
    """Raised when an external data source fails and no cached fallback is available."""

    def __init__(self, source_key: str, reason: str) -> None:
        super().__init__(
            code="SOURCE_UNAVAILABLE",
            message=f"External data source '{source_key}' is unavailable: {reason}",
            status_code=503,
            details={"source_key": source_key, "reason": reason},
        )


class NoTieInError(AppError):
    """Raised when grid extension planning is requested without a defined tie-in point."""

    def __init__(self, project_id: str) -> None:
        super().__init__(
            code="NO_TIE_IN_POINT",
            message=(
                "Grid-extension planning requires at least one existing or assumed "
                "11 kV tie-in point. Place an assumed tie-in point or upload utility GIS data."
            ),
            status_code=422,
            details={"project_id": project_id},
        )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach standard error envelope handlers to the FastAPI application."""

    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request payload validation failed.",
                    "details": {"errors": exc.errors()},
                }
            },
        )

