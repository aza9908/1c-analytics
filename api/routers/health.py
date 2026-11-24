from fastapi import APIRouter

from api.deps import db_conn

router = APIRouter(tags=["meta"])


@router.get("/health")
async def health() -> dict:
    """Liveness + DB ping. Returns 200 with `db: ok` when DB is reachable."""
    try:
        async with db_conn() as conn:
            await conn.fetchval("SELECT 1")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {type(e).__name__}"
    return {"status": "ok", "db": db_status}
