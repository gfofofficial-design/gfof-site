// Fixed reviewed layouts from the unchanged SQL candidates. No runtime learning.
const data = {
  sourceHashes: {"alliance-account-protocol-candidate.sql":"4905155cfd42411c5e8360867b7769fee3b44d3579549b13ece19e45e903a4bf","alliance-account-history-store-candidate.sql":"bfb970a3b7ded45c1ea229c7b4a2b0d9da120cb7a9a1de3509ca7265939bdecb","alliance-account-ack-store-candidate.sql":"ec6ba27cba10c8504c7688500a24aca6d2c4a1777a7fcfa06938635a5279fb81"},
  history: {
    defaultAcl: [["alliance_account_owner","GLOBAL","f",[["alliance_account_owner","alliance_account_owner","EXECUTE",false]]]],
    tables: {
      entries: {
        columns: [
          [1,"sequence",10,"pg_catalog","int4",-1,0,true,"","",false,true,0,false,null,null,null,null,null],
          [2,"event_id",10,"pg_catalog","text",-1,0,true,"","",false,true,0,false,null,null,"pg_catalog","default",null],
          [3,"record",10,"pg_catalog","jsonb",-1,0,true,"","",false,true,0,false,null,null,null,null,null],
        ],
        indexes: [
          ["entries_event_id_key","CREATE UNIQUE INDEX entries_event_id_key ON alliance_account.entries USING btree (event_id)",true,false,true,true,true,true,false,false,"btree","alliance_account_owner",null],
          ["entries_pkey","CREATE UNIQUE INDEX entries_pkey ON alliance_account.entries USING btree (sequence)",true,true,true,true,true,true,false,false,"btree","alliance_account_owner",null],
        ],
        ordinary: true,
        policies: [
          ["owner_only","*",true,["alliance_account_owner"],"true","true"],
        ],
        constraints: [
          ["entries_event_id_check","c",[2],"CHECK ((event_id ~ '^[0-9a-f]{64}$'::text))",false,false,true,true,0,false],
          ["entries_event_id_key","u",[2],"UNIQUE (event_id)",false,false,true,true,0,true],
          ["entries_pkey","p",[1],"PRIMARY KEY (sequence)",false,false,true,true,0,true],
          ["entries_record_check","c",[3],"CHECK ((jsonb_typeof(record) = 'object'::text))",false,false,true,true,0,false],
          ["entries_sequence_check","c",[1],"CHECK (((sequence >= 1) AND (sequence <= 256)))",false,false,true,true,0,false],
        ],
        constraintSafety: true,
      },
      history_control: {
        columns: [
          [1,"id",10,"pg_catalog","bool",-1,0,true,"","",false,true,0,false,null,null,null,null,"true"],
          [2,"scope",10,"pg_catalog","jsonb",-1,0,false,"","",false,true,0,false,null,null,null,null,null],
          [3,"enabled",10,"pg_catalog","bool",-1,0,true,"","",false,true,0,false,null,null,null,null,"false"],
          [4,"admissions_open",10,"pg_catalog","bool",-1,0,true,"","",false,true,0,false,null,null,null,null,"false"],
          [5,"sequence",10,"pg_catalog","int4",-1,0,true,"","",false,true,0,false,null,null,null,null,"0"],
          [6,"sha256",10,"pg_catalog","text",-1,0,true,"","",false,true,0,false,null,null,"pg_catalog","default","repeat('0'::text, 64)"],
        ],
        indexes: [
          ["history_control_pkey","CREATE UNIQUE INDEX history_control_pkey ON alliance_account.history_control USING btree (id)",true,true,true,true,true,true,false,false,"btree","alliance_account_owner",null],
        ],
        ordinary: true,
        policies: [
          ["owner_only","*",true,["alliance_account_owner"],"true","true"],
        ],
        constraints: [
          ["history_control_check","c",[4,3],"CHECK (((NOT admissions_open) OR enabled))",false,false,true,true,0,false],
          ["history_control_check1","c",[2,3,4,5],"CHECK (((scope IS NOT NULL) OR ((NOT enabled) AND (NOT admissions_open) AND (sequence = 0))))",false,false,true,true,0,false],
          ["history_control_check2","c",[5,6],"CHECK (((sequence <> 0) OR (sha256 = repeat('0'::text, 64))))",false,false,true,true,0,false],
          ["history_control_id_check","c",[1],"CHECK (id)",false,false,true,true,0,false],
          ["history_control_pkey","p",[1],"PRIMARY KEY (id)",false,false,true,true,0,true],
          ["history_control_scope_check","c",[2],"CHECK (((scope IS NULL) OR alliance_account.scope_ok(scope)))",false,false,true,true,0,false],
          ["history_control_sequence_check","c",[5],"CHECK (((sequence >= 0) AND (sequence <= 256)))",false,false,true,true,0,false],
          ["history_control_sha256_check","c",[6],"CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text))",false,false,true,true,0,false],
        ],
        constraintSafety: true,
      },
    },
  },
  ack: {
    defaultAcl: [["alliance_account_owner","GLOBAL","f",[["alliance_account_owner","alliance_account_owner","EXECUTE",false]]]],
    tables: {
      ack_control: {
        columns: [
          [1,"id",10,"pg_catalog","bool",-1,0,true,"","",false,true,0,false,null,null,null,null,"true"],
          [2,"scope",10,"pg_catalog","jsonb",-1,0,false,"","",false,true,0,false,null,null,null,null,null],
          [3,"enabled",10,"pg_catalog","bool",-1,0,true,"","",false,true,0,false,null,null,null,null,"false"],
          [4,"sequence",10,"pg_catalog","int4",-1,0,true,"","",false,true,0,false,null,null,null,null,"0"],
          [5,"sha256",10,"pg_catalog","text",-1,0,true,"","",false,true,0,false,null,null,"pg_catalog","default","repeat('0'::text, 64)"],
        ],
        indexes: [
          ["ack_control_pkey","CREATE UNIQUE INDEX ack_control_pkey ON alliance_account.ack_control USING btree (id)",true,true,true,true,true,true,false,false,"btree","alliance_account_owner",null],
        ],
        ordinary: true,
        policies: [
          ["owner_only","*",true,["alliance_account_owner"],"true","true"],
        ],
        constraints: [
          ["ack_control_check","c",[2,3,4],"CHECK (((scope IS NOT NULL) OR ((NOT enabled) AND (sequence = 0))))",false,false,true,true,0,false],
          ["ack_control_check1","c",[4,5],"CHECK (((sequence <> 0) OR (sha256 = repeat('0'::text, 64))))",false,false,true,true,0,false],
          ["ack_control_id_check","c",[1],"CHECK (id)",false,false,true,true,0,false],
          ["ack_control_pkey","p",[1],"PRIMARY KEY (id)",false,false,true,true,0,true],
          ["ack_control_scope_check","c",[2],"CHECK (((scope IS NULL) OR alliance_account.scope_ok(scope)))",false,false,true,true,0,false],
          ["ack_control_sequence_check","c",[4],"CHECK (((sequence >= 0) AND (sequence <= 256)))",false,false,true,true,0,false],
          ["ack_control_sha256_check","c",[5],"CHECK ((sha256 ~ '^[0-9a-f]{64}$'::text))",false,false,true,true,0,false],
        ],
        constraintSafety: true,
      },
    },
  },
};
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export default freeze(data);
