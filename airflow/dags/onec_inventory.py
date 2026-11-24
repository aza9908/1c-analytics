"""DAG-заготовка: срезы остатков (себестоимость).

Loader сейчас raise-ит NotImplementedError — DAG активируется когда
пользователь подтвердит SliceLast() энд-поинт.
"""
from __future__ import annotations

from _dag_factory import make_etl_dag
from etl.loaders.inventory import main as load_inventory

dag = make_etl_dag(
    dag_id="onec_inventory",
    schedule="30 3 * * *",
    loader=load_inventory,
    description="[TODO] AccumulationRegister_СебестоимостьТоваров.SliceLast → raw.inventory_snapshots",
    tags=["onec", "etl", "todo"],
)
