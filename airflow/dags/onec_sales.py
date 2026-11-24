"""DAG-заготовка: реализации с себестоимостью (для GP/markup).

Loader сейчас raise-ит NotImplementedError — DAG остаётся paused в Airflow
(AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION=true), активируется когда
пользователь подтвердит точный OData-эндпоинт.
"""
from __future__ import annotations

from _dag_factory import make_etl_dag
from etl.loaders.sales import main as load_sales

dag = make_etl_dag(
    dag_id="onec_sales",
    schedule="15 * * * *",
    loader=load_sales,
    description="[TODO] Document_РеализацияТоваровУслуг → raw.sales",
    tags=["onec", "etl", "todo"],
)
