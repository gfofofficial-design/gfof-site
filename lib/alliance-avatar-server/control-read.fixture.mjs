// Separate-process persistence proof. ONLY fixed disposable loopback inputs.
import {Pool} from 'pg';
import {controlPolicy} from './control-policy.mjs';
if(process.env.ALLIANCE_AVATAR_SERVER_TEST_CONFIRM!=='disposable_server_fixture')throw Error('Wrong control child fixture');
let text='';for await(const chunk of process.stdin){text+=chunk;if(text.length>8192)throw Error('Fixture input too large');}
const {config,scope}=JSON.parse(text);
if(config.host!=='127.0.0.1'||![55490,54331].includes(config.port)||config.user!=='alliance_control_reader'||config.password!=='synthetic-journal-creation-password-only'||config.database!=='postgres'||config.ssl?.servername!=='localhost'||config.ssl?.rejectUnauthorized!==true||scope.memberProjectRef!=='abcdefghijklmnopqrst'||scope.journalProjectRef!=='uvwxyzabcdefghijklmn')throw Error('Wrong control child identity');
const pool=new Pool(config);try{const r=await pool.query('SELECT alliance_control.read_policy($1::text,$2::text,$3::uuid) AS result',[scope.memberProjectRef,scope.journalProjectRef,scope.epoch]);console.log(controlPolicy(r.rows[0].result).sha256);}finally{await pool.end();}
