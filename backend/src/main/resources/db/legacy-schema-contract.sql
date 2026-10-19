SELECT 'COLUMN|' || c.relname || '|' || a.attname || '|' || pg_catalog.format_type(a.atttypid,a.atttypmod) || '|' || a.attnotnull
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
UNION ALL
SELECT 'CONSTRAINT|' || c.relname || '|' || pg_get_constraintdef(k.oid)
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
-- UNIQUE constraints are compared through their backing indexes below. Legacy upgrades
-- sometimes created the equivalent unique index directly, without a named constraint.
WHERE n.nspname='public' AND k.contype <> 'u'
UNION ALL
SELECT 'INDEX|' || c.relname || '|' || regexp_replace(
    CASE WHEN c.relname='student_session_packages' AND i.indisunique
              AND pg_get_expr(i.indpred,i.indrelid)='(entitlement_id IS NOT NULL)'
              AND pg_get_indexdef(i.indexrelid) LIKE '% USING btree (entitlement_id) WHERE %'
         -- NULLs are distinct in both forms: the historical non-null-only unique index
         -- and the fresh UNIQUE(entitlement_id) enforce precisely the same rule.
         THEN regexp_replace(pg_get_indexdef(i.indexrelid), ' WHERE .*$', '')
         ELSE pg_get_indexdef(i.indexrelid) END, 'INDEX [^ ]+ ON ', 'INDEX ON ')
FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
ORDER BY 1;
