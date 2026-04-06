"""GreenPulse Backend — FastAPI Application Entry Point"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# TODO: import routers
# from app.api.v1 import verify, certificates, users, health

app = FastAPI(
    title="GreenPulse API",
    version="1.0.0",
    description="Tree planting verification backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "greenpulse-backend"}
