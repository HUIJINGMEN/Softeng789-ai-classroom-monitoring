WITH schema_scope AS (SELECT oid FROM pg_namespace WHERE nspname='public')
SELECT 'COLUMN|' || c.relname || '|' || a.attname || '|' || pg_catalog.format_type(a.atttypid,a.atttypmod) || '|' || a.attnotnull AS definition
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN schema_scope n ON n.oid=c.relnamespace
WHERE c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
UNION ALL
SELECT 'CONSTRAINT|' || c.relname || '|' || pg_get_constraintdef(k.oid)
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN schema_scope n ON n.oid=c.relnamespace
-- UNIQUE constraints are compared through their backing indexes below. Legacy upgrades
-- sometimes created the equivalent unique index directly, without a named constraint.
WHERE k.contype <> 'u'
UNION ALL
SELECT 'INDEX|' || c.relname || '|' || regexp_replace(
    CASE WHEN c.relname='student_session_packages' AND i.indisunique
              AND pg_get_expr(i.indpred,i.indrelid)='(entitlement_id IS NOT NULL)'
              AND position(' USING btree (entitlement_id) WHERE ' IN pg_get_indexdef(i.indexrelid)) > 0
         -- NULLs are distinct in both forms: the historical non-null-only unique index
         -- and the fresh UNIQUE(entitlement_id) enforce precisely the same rule.
         THEN regexp_replace(pg_get_indexdef(i.indexrelid), ' WHERE .*$', '')
         ELSE pg_get_indexdef(i.indexrelid) END, 'INDEX [^ ]+ ON ', 'INDEX ON ')
FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN schema_scope n ON n.oid=c.relnamespace
ORDER BY definition ASC;
