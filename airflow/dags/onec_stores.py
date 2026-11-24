"""Daily DAG: справочник складов (имена обновлять — цвета засижены в миграции)."""
from __future__ import annotations

from _dag_factory import make_etl_dag
from etl.loaders.stores import main as load_stores

dag = make_etl_dag(
    dag_id="onec_stores",
    schedule="5 3 * * *",
    loader=load_stores,
    description="Catalog_Склады → raw.stores + mart.stores (name only)",
)
