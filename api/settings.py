from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    db_host: str = Field(default="postgres", alias="ONEC_DB_HOST")
    db_port: int = Field(default=5432, alias="ONEC_DB_PORT")
    db_name: str = Field(default="onec", alias="ONEC_DB_NAME")
    db_user: str = Field(default="postgres", alias="ONEC_DB_USER")
    db_password: str = Field(default="", alias="ONEC_DB_PASSWORD")
    timezone: str = Field(default="Asia/Almaty", alias="ONEC_TIMEZONE")

    allowed_origins: str = Field(
        default="http://localhost:3000",
        alias="ALLOWED_ORIGINS",
    )
    api_key: str = Field(default="", alias="API_KEY")

    @property
    def dsn(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


settings = Settings()
