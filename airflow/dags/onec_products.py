"""Daily DAG: справочник номенклатуры."""
from __future__ import annotations

from _dag_factory import make_etl_dag
from etl.loaders.products import main as load_products

dag = make_etl_dag(
    dag_id="onec_products",
    schedule="0 3 * * *",
    loader=load_products,
    description="Catalog_Номенклатура → raw.products + mart.products",
)
