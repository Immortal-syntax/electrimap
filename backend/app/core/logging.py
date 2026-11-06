"""Structured JSON and console logging setup."""

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects with contextual identifiers."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for extra_key in ("request_id", "user_id", "project_id", "job_id", "code"):
            value = getattr(record, extra_key, None)
            if value is not None:
                payload[extra_key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=True)


def configure_logging(level: str = "INFO") -> None:
    """Configure root application logger."""
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not any(isinstance(h, logging.StreamHandler) for h in root_logger.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(StructuredJsonFormatter())
        root_logger.addHandler(handler)
