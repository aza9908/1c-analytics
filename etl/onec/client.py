"""1C OData REST client. httpx + tenacity + basic auth + $skip/$top пагинация."""
from __future__ import annotations

import logging
from typing import Any, Iterator
from urllib.parse import quote

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from etl.config import OnecConfig

logger = logging.getLogger(__name__)


class OnecClient:
    """Тонкая обёртка над OData v3 (json-формат).

    Использование:
        with OnecClient(cfg) as client:
            for batch in client.paginate("Document_ЧекККМ", filter_="Date ge datetime'2026-01-01'"):
                handle(batch)
    """

    def __init__(self, cfg: OnecConfig):
        self.cfg = cfg
        self.session = httpx.Client(
            base_url=cfg.url,
            auth=(cfg.user, cfg.password),
            headers={
                "Accept": "application/json",
                "User-Agent": cfg.user_agent,
            },
            timeout=httpx.Timeout(60.0, read=180.0),
        )

    # context-manager
    def close(self) -> None:
        self.session.close()

    def __enter__(self) -> "OnecClient":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, max=32),
        retry=retry_if_exception_type((httpx.HTTPError,)),
        reraise=True,
    )
    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        # urls с кириллицей: 1C-OData принимает Document_ЧекККМ как есть, но httpx
        # квотирует автоматически. Если path уже закодирован — оставляем.
        r = self.session.get(path, params=params)
        if r.status_code >= 500:
            r.raise_for_status()  # триггерит retry
        if r.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"1C OData {r.status_code}: {r.text[:300]}",
                request=r.request,
                response=r,
            )
        return r.json()

    def paginate(
        self,
        entity: str,
        *,
        filter_: str | None = None,
        select: str | None = None,
        order_by: str | None = None,
        expand: str | None = None,
        page_size: int | None = None,
    ) -> Iterator[list[dict[str, Any]]]:
        """OData $skip/$top пагинация. Yield-ит батчи (списки dict)."""
        size = page_size or self.cfg.default_page_size
        skip = 0
        while True:
            params: dict[str, Any] = {
                "$format": "json",
                "$top": size,
                "$skip": skip,
            }
            if filter_:
                params["$filter"] = filter_
            if select:
                params["$select"] = select
            if order_by:
                params["$orderby"] = order_by
            if expand:
                params["$expand"] = expand
            data = self._get(entity, params=params)
            batch = data.get("value", [])
            if not batch:
                return
            yield batch
            if len(batch) < size:
                return
            skip += size

    def get_one(
        self,
        entity: str,
        *,
        filter_: str | None = None,
        select: str | None = None,
        order_by: str | None = None,
    ) -> dict[str, Any] | None:
        """Получить одну запись (например, последний чек по Date desc)."""
        params: dict[str, Any] = {"$format": "json", "$top": 1}
        if filter_:
            params["$filter"] = filter_
        if select:
            params["$select"] = select
        if order_by:
            params["$orderby"] = order_by
        data = self._get(entity, params=params)
        rows = data.get("value", [])
        return rows[0] if rows else None
