"""GreenPulse Backend — FastAPI Application Entry Point"""
import logging

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.core.config import get_settings
from app.api.v1 import verify, certificates, users, health

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

    # ── Sentry ────────────────────────────────────────────────────────────────
    if settings.SENTRY_DSN_BACKEND:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN_BACKEND,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            traces_sample_rate=0.2,  # 20% of requests traced
            # Never send PII in Sentry events
            send_default_pii=False,
        )
        logger.info("Sentry initialised")

    # ── App ───────────────────────────────────────────────────────────────────
    app = FastAPI(
        title="GreenPulse API",
        version="1.0.0",
        description=(
            "Tree planting verification backend. "
            "POST /api/v1/verify is the critical path endpoint."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://greenpulse.app", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # ── Global error handler (no PII in response) ─────────────────────────────
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}},
        )

    # ── Routers ───────────────────────────────────────────────────────────────
    PREFIX = "/api/v1"
    app.include_router(verify.router, prefix=PREFIX, tags=["verification"])
    app.include_router(certificates.router, prefix=PREFIX, tags=["certificates"])
    app.include_router(users.router, prefix=PREFIX, tags=["users"])
    app.include_router(health.router, tags=["health"])

    return app


app = create_app()
