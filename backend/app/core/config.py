from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Predictive Maintenance System"
    environment: str = "development"
    secret_key: str = "change-me-in-env"
    access_token_expire_minutes: int = 480
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    database_url: str = "mysql+pymysql://pm_user:change_this_password@127.0.0.1:3306/predictive_maintenance?charset=utf8mb4"
    cors_origins: str = "http://127.0.0.1:5500,http://localhost:5500"

    admin_email: str = "admin@example.com"
    admin_password: str = "ChangeThisAdminPassword123!"

    prediction_interval_minutes: int = 10
    failure_horizon_hours: int = 24
    event_trigger_enabled: bool = True
    alert_failure_probability: float = 0.60
    high_risk_failure_probability: float = 0.80
    critical_risk_failure_probability: float = 0.95
    simulator_interval_seconds: int = 5
    simulator_api_url: str = "http://127.0.0.1:8000/api/v1"
    artifacts_dir: str = "artifacts"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False, extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
