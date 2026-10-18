// Bounded catalogue layout expression; c is the reviewed outer table row.
// pg18 records NOT NULL in pg_constraint as well as pg_attribute. Its enforcement
// is checked below; redundant constraint names are not a cross-version contract.
// Column tuple: ordinal/name/type-owner-OID/type-schema/type-name/typmod/dimensions,
// NOT NULL/identity/generated/dropped/local/inherited-count/missing-value flag,
// options/FDW-options/collation-schema/name/default-or-generation expression.
export const ACCOUNT_TABLE_LAYOUT_SQL=`jsonb_build_object(
 'columns',(SELECT jsonb_agg(v ORDER BY position) FROM (
  SELECT a.attnum AS position,jsonb_build_array(a.attnum,a.attname,t.typowner::integer,tn.nspname,t.typname,a.atttypmod,a.attndims,a.attnotnull,a.attidentity,a.attgenerated,a.attisdropped,a.attislocal,a.attinhcount,a.atthasmissing,a.attoptions,a.attfdwoptions,cn.nspname,co.collname,pg_catalog.pg_get_expr(d.adbin,d.adrelid,false)) AS v
  FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_type t ON t.oid=a.atttypid LEFT JOIN pg_catalog.pg_namespace tn ON tn.oid=t.typnamespace
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum LEFT JOIN pg_catalog.pg_collation co ON co.oid=a.attcollation LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid=co.collnamespace
  WHERE a.attrelid=c.oid AND a.attnum>0 ORDER BY a.attnum LIMIT 17
 ) x),
 'constraints',(SELECT jsonb_agg(v ORDER BY name) FROM (
  SELECT k.conname AS name,jsonb_build_array(k.conname,k.contype,k.conkey,pg_catalog.pg_get_constraintdef(k.oid,false),k.condeferrable,k.condeferred,k.convalidated,k.conislocal,k.coninhcount,k.connoinherit) AS v
  FROM pg_catalog.pg_constraint k WHERE k.conrelid=c.oid AND k.contype<>'n' ORDER BY k.conname LIMIT 17
 ) x),
 'constraintSafety',NOT EXISTS(SELECT 1 FROM pg_catalog.pg_constraint k WHERE k.conrelid=c.oid AND (k.conparentid<>0 OR k.confrelid<>0 OR k.contypid<>0 OR k.condeferrable OR k.condeferred OR NOT k.convalidated OR NOT k.conislocal OR k.coninhcount<>0 OR NOT coalesce((to_jsonb(k)->>'conenforced')::boolean,true) OR coalesce((to_jsonb(k)->>'conperiod')::boolean,false))),
 'indexes',(SELECT jsonb_agg(v ORDER BY name) FROM (
  SELECT ic.relname AS name,jsonb_build_array(ic.relname,pg_catalog.pg_get_indexdef(i.indexrelid),i.indisunique,i.indisprimary,i.indisvalid,i.indisready,i.indislive,i.indimmediate,i.indisreplident,i.indnullsnotdistinct,am.amname,pg_catalog.pg_get_userbyid(ic.relowner),ic.reloptions) AS v
  FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid JOIN pg_catalog.pg_am am ON am.oid=ic.relam WHERE i.indrelid=c.oid ORDER BY ic.relname LIMIT 9
 ) x),
 'policies',(SELECT jsonb_agg(v ORDER BY name) FROM (
  SELECT p.polname AS name,jsonb_build_array(p.polname,p.polcmd,p.polpermissive,(SELECT jsonb_agg(role_name ORDER BY ordinal) FROM (SELECT CASE WHEN id=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(id) END AS role_name,ordinal FROM unnest(p.polroles) WITH ORDINALITY AS r(id,ordinal) ORDER BY ordinal LIMIT 9) rs),pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false)) AS v
  FROM pg_catalog.pg_policy p WHERE p.polrelid=c.oid ORDER BY p.polname LIMIT 9
 ) x),
 'ordinary',c.relpersistence='p' AND NOT c.relispartition AND c.reloptions IS NULL AND c.relreplident='d' AND (SELECT amname='heap' FROM pg_catalog.pg_am WHERE oid=c.relam) AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_inherits WHERE inhrelid=c.oid OR inhparent=c.oid) AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_rewrite WHERE ev_class=c.oid)
)`;
export const ACCOUNT_DEFAULT_ACL_SQL=`SELECT coalesce(jsonb_agg(v ORDER BY creator,namespace,kind),'[]'::jsonb) FROM (
 SELECT pg_catalog.pg_get_userbyid(d.defaclrole) AS creator,CASE WHEN d.defaclnamespace=0 THEN 'GLOBAL' ELSE n.nspname END AS namespace,d.defaclobjtype AS kind,
 jsonb_build_array(pg_catalog.pg_get_userbyid(d.defaclrole),CASE WHEN d.defaclnamespace=0 THEN 'GLOBAL' ELSE n.nspname END,d.defaclobjtype,
 (SELECT jsonb_agg(v ORDER BY v->>0,v->>2) FROM (SELECT jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END,pg_catalog.pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) AS v FROM pg_catalog.aclexplode(d.defaclacl) a LIMIT 9) acl)) AS v
 FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclrole=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='alliance_account_owner') OR n.nspname='alliance_account' ORDER BY creator,namespace,kind LIMIT 9
) x`;
