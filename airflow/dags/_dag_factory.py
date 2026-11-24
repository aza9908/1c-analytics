"""Common DAG-фабрика для 1C ETL.

Каждый per-entity DAG — одна тонкая task'а, вызывающая `main()` соответствующего
loader'а. Логика (watermark, ретраи, проектор) живёт в `etl.loaders.*`.

Параметры по умолчанию:
- retries=3, exponential backoff
- max_active_runs=1 — нельзя двух прогонов одной сущности параллельно
- catchup=False — не проигрываем пропущенные слоты
- depends_on_past=False
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Callable

from airflow.decorators import dag, task

DEFAULT_ARGS = {
    "owner": "etl",
    "retries": 3,
    "retry_delay": timedelta(seconds=30),
    "retry_exponential_backoff": True,
    "max_retry_delay": timedelta(minutes=5),
    "depends_on_past": False,
}


def make_etl_dag(
    *,
    dag_id: str,
    schedule: str,
    loader: Callable[[], None],
    description: str,
    tags: list[str] | None = None,
):
    """Сгенерировать DAG, вызывающий loader().

    Использование:

        from etl.loaders.receipts import main as load_receipts
        DAG = make_etl_dag(
            dag_id="onec_receipts",
            schedule="5 * * * *",
            loader=load_receipts,
            description="...",
        )
    """
    @dag(
        dag_id=dag_id,
        description=description,
        schedule=schedule,
        start_date=datetime(2026, 5, 1),
        catchup=False,
        max_active_runs=1,
        tags=tags or ["onec", "etl"],
        default_args=DEFAULT_ARGS,
        # Один прогон не должен висеть дольше часа — иначе следующий слот пропустим.
        dagrun_timeout=timedelta(minutes=55),
    )
    def _generated():
        @task(task_id="run")
        def _run():
            loader()
        _run()

    return _generated()
