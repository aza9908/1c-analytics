from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from api.deps import close_pool, init_pool
from api.routers import data, etl, health, live
from api.settings import settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_pool()
    yield
    await close_pool()


app = FastAPI(
    title="1c-analytics API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(live.router)
app.include_router(data.router)
app.include_router(etl.router)


@app.get("/")
async def root() -> dict:
    return {"service": "1c-analytics-api", "version": app.version}
