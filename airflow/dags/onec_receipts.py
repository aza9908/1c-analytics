"""Hourly DAG: подкачать новые чеки ККМ из 1C OData."""
from __future__ import annotations

from _dag_factory import make_etl_dag
from etl.loaders.receipts import main as load_receipts

dag = make_etl_dag(
    dag_id="onec_receipts",
    schedule="5 * * * *",
    loader=load_receipts,
    description="Document_ЧекККМ → raw.receipts + mart.receipts/items",
)
