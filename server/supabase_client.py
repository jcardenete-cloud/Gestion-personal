import os
from supabase import create_client
from config import config

SUPABASE_URL = os.environ.get('SUPABASE_URL') or getattr(config, 'SUPABASE_URL', None)
SUPABASE_KEY = os.environ.get('SUPABASE_KEY') or getattr(config, 'SUPABASE_KEY', None)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        'SUPABASE_URL and SUPABASE_KEY must be configured for Postgres access via Supabase.'
    )

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Default schema for Supabase (PostgREST) – can be overridden via env var
SCHEMA = os.getenv('SUPABASE_SCHEMA', 'jcf')


def _table(table_name):
    # Always query the configured schema; the SDK's .schema() returns a scoped client
    return supabase.schema(SCHEMA).from_(table_name.lower())


def _normalize_row_keys(data):
    if isinstance(data, dict):
        return {str(k).upper(): v for k, v in data.items()}
    if isinstance(data, list):
        return [{str(k).upper(): v for k, v in row.items()} for row in data]
    return data


def _normalize_params(params):
    if isinstance(params, dict):
        return {str(k).lower(): v for k, v in params.items() if v is not None}
    return params


def _apply_filters(query_builder, filters):
    if not filters:
        return query_builder
    for key, value in filters.items():
        lower_key = str(key).lower()
        if isinstance(value, list):
            query_builder = query_builder.in_(lower_key, value)
        elif value is None:
            query_builder = query_builder.is_(lower_key, None)
        else:
            query_builder = query_builder.eq(lower_key, value)
    return query_builder


def select(table_name, filters=None, order=None, distinct=None, limit=None):
    builder = _table(table_name).select('*')
    builder = _apply_filters(builder, filters)
    if distinct:
        builder = builder.select(distinct)
    if order:
        builder = builder.order(order)
    if limit is not None:
        builder = builder.limit(limit)
    response = builder.execute()
    return _normalize_row_keys(response.data or [])


def select_distinct(table_name, field_name):
    response = _table(table_name).select(field_name).execute()
    rows = response.data or []
    values = sorted({row.get(field_name.lower()) for row in rows if row.get(field_name.lower()) is not None})
    return values


def insert(table_name, data):
    normalized = []
    if isinstance(data, list):
        normalized = [{k.lower(): v for k, v in row.items()} for row in data]
    else:
        normalized = [{k.lower(): v for k, v in data.items()}]
    response = _table(table_name).insert(normalized).execute()
    return _normalize_row_keys(response.data or [])


def update(table_name, updates, filters):
    builder = _table(table_name).update({k.lower(): v for k, v in updates.items()})
    builder = _apply_filters(builder, filters)
    response = builder.execute()
    return _normalize_row_keys(response.data or [])


def delete(table_name, filters):
    builder = _table(table_name).delete()
    builder = _apply_filters(builder, filters)
    response = builder.execute()
    return response.data or []


def delete_all(table_name):
    response = _table(table_name).delete().execute()
    return response.data or []
