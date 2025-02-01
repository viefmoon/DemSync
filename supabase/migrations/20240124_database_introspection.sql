-- Función para obtener tablas y sus columnas
create or replace function public.get_tables()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    WITH table_columns AS (
        SELECT 
            c.relname as table_name,
            jsonb_agg(
                jsonb_build_object(
                    'column_name', a.attname,
                    'data_type', pg_catalog.format_type(a.atttypid, a.atttypmod),
                    'is_nullable', CASE WHEN a.attnotnull THEN false ELSE true END,
                    'is_primary_key', CASE WHEN pk.contype = 'p' THEN true ELSE false END
                ) ORDER BY a.attnum
            ) as columns
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attribute a ON a.attrelid = c.oid
        LEFT JOIN pg_constraint pk ON 
            pk.conrelid = c.oid AND 
            pk.contype = 'p' AND 
            a.attnum = ANY(pk.conkey)
        WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND a.attnum > 0
        AND NOT a.attisdropped
        GROUP BY c.relname
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'table_name', tc.table_name,
            'columns', tc.columns
        )
    )
    INTO result
    FROM table_columns tc;

    return coalesce(result, '[]'::jsonb);
end;
$$;

-- Función para obtener funciones
create or replace function public.get_functions()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    SELECT jsonb_agg(
        jsonb_build_object(
            'routine_name', p.proname,
            'routine_type', CASE p.prokind
                WHEN 'f' THEN 'FUNCTION'
                WHEN 'p' THEN 'PROCEDURE'
                ELSE 'UNKNOWN'
            END,
            'routine_definition', pg_get_functiondef(p.oid)
        )
    )
    INTO result
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public';

    return coalesce(result, '[]'::jsonb);
end;
$$;

-- Función para obtener políticas RLS
create or replace function public.get_policies()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    SELECT jsonb_agg(
        jsonb_build_object(
            'schemaname', n.nspname,
            'tablename', c.relname,
            'policyname', p.polname,
            'roles', to_jsonb(p.polroles),
            'cmd', p.polcmd,
            'qual', pg_get_expr(p.polqual, p.polrelid),
            'with_check', pg_get_expr(p.polwithcheck, p.polrelid),
            'operation', case p.polcmd
                when 'r' then 'SELECT'
                when 'a' then 'INSERT'
                when 'w' then 'UPDATE'
                when 'd' then 'DELETE'
                else 'ALL'
            end,
            'definition', pg_get_expr(p.polqual, p.polrelid)
        )
    )
    INTO result
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public';

    return coalesce(result, '[]'::jsonb);
end;
$$;

-- Función para obtener llaves foráneas
create or replace function public.get_foreign_keys()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    SELECT jsonb_agg(
        jsonb_build_object(
            'constraint_name', c.conname,
            'table_name', c1.relname,
            'column_name', a1.attname,
            'foreign_table_name', c2.relname,
            'foreign_column_name', a2.attname
        )
    )
    INTO result
    FROM pg_constraint c
    JOIN pg_class c1 ON c1.oid = c.conrelid
    JOIN pg_class c2 ON c2.oid = c.confrelid
    JOIN pg_attribute a1 ON a1.attnum = c.conkey[1] AND a1.attrelid = c.conrelid
    JOIN pg_attribute a2 ON a2.attnum = c.confkey[1] AND a2.attrelid = c.confrelid
    JOIN pg_namespace n ON n.oid = c1.relnamespace
    WHERE c.contype = 'f'
    AND n.nspname = 'public';

    return coalesce(result, '[]'::jsonb);
end;
$$;

-- Función para obtener índices
create or replace function public.get_indexes()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    SELECT jsonb_agg(
        jsonb_build_object(
            'index_name', i.relname,
            'table_name', t.relname,
            'column_name', a.attname,
            'is_unique', ix.indisunique
        )
    )
    INTO result
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE a.attnum = ANY(ix.indkey)
    AND t.relkind = 'r'
    AND n.nspname = 'public';

    return coalesce(result, '[]'::jsonb);
end;
$$;

-- Función para obtener triggers
create or replace function public.get_triggers()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    SELECT jsonb_agg(
        jsonb_build_object(
            'trigger_name', t.tgname,
            'table_name', c.relname,
            'trigger_type', CASE 
                WHEN t.tgtype & 1 = 1 THEN 'ROW'
                ELSE 'STATEMENT'
            END,
            'trigger_timing', CASE 
                WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
                WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF'
                ELSE 'AFTER'
            END,
            'trigger_definition', pg_get_triggerdef(t.oid)
        )
    )
    INTO result
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE NOT t.tgisinternal
    AND n.nspname = 'public';

    return coalesce(result, '[]'::jsonb);
end;
$$;

-- Función para obtener vistas
create or replace function public.get_views()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    SELECT jsonb_agg(
        jsonb_build_object(
            'view_name', c.relname,
            'view_definition', pg_get_viewdef(c.oid),
            'is_updatable', c.relkind = 'v'
        )
    )
    INTO result
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v', 'm')
    AND n.nspname = 'public';

    return coalesce(result, '[]'::jsonb);
end;
$$;

-- Función para obtener extensiones
create or replace function public.get_extensions()
returns jsonb
language plpgsql
security definer
as $$
declare
    result jsonb;
begin
    SELECT jsonb_agg(
        jsonb_build_object(
            'name', e.extname,
            'version', e.extversion,
            'description', x.description
        )
    )
    INTO result
    FROM pg_extension e
    LEFT JOIN pg_description x ON x.objoid = e.oid;

    return coalesce(result, '[]'::jsonb);
end;
$$;