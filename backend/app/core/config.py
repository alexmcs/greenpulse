"""Backend configuration — reads from environment variables."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # AWS Rekognition
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "eu-west-1"
    AWS_REKOGNITION_PROJECT_ARN: str = ""

    # RevenueCat
    REVENUECAT_ANDROID_API_KEY: str = ""

    # PostHog
    POSTHOG_API_KEY: str = ""
    POSTHOG_HOST: str = "https://eu.posthog.com"

    # Sentry
    SENTRY_DSN_BACKEND: str = ""

    # App
    SECRET_KEY: str = ""
    CERTIFICATE_BASE_URL: str = "https://greenpulse.app/verify"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
