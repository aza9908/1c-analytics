"""Конфигурация ETL: читается из env-переменных, прокинутых через docker-compose."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class OnecConfig:
    """1C OData API endpoint + basic auth."""
    url: str
    user: str
    password: str
    timezone: str = "Asia/Almaty"
    user_agent: str = "1c-analytics/0.1 (+etl)"
    # OData $top limit — стандартный page size.
    default_page_size: int = 1000


@dataclass(frozen=True)
class DbConfig:
    host: str
    port: int
    database: str
    user: str
    password: str

    @property
    def dsn(self) -> str:
        return (
            f"host={self.host} port={self.port} dbname={self.database} "
            f"user={self.user} password={self.password}"
        )


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"environment variable {name} is required")
    return value


def onec_config() -> OnecConfig:
    return OnecConfig(
        url=_require("ONEC_ODATA_URL").rstrip("/"),
        user=_require("ONEC_ODATA_USER"),
        password=_require("ONEC_ODATA_PASSWORD"),
        timezone=os.getenv("ONEC_TIMEZONE", "Asia/Almaty"),
    )


def db_config() -> DbConfig:
    return DbConfig(
        host=os.getenv("ONEC_DB_HOST", "postgres"),
        port=int(os.getenv("ONEC_DB_PORT", "5432")),
        database=os.getenv("ONEC_DB_NAME", "onec"),
        user=_require("ONEC_DB_USER"),
        password=_require("ONEC_DB_PASSWORD"),
    )
