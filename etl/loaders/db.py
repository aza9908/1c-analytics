"""Postgres connection helpers (psycopg 3)."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg import Connection

from etl.config import db_config


@contextmanager
def connect(*, autocommit: bool = False) -> Iterator[Connection]:
    """Открывает соединение к рабочей БД onec."""
    cfg = db_config()
    conn = psycopg.connect(cfg.dsn, autocommit=autocommit)
    try:
        yield conn
        if not autocommit:
            conn.commit()
    except Exception:
        if not autocommit:
            conn.rollback()
        raise
    finally:
        conn.close()
