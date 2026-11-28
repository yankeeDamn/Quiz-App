'use strict';
require('dotenv').config();
const db=require('../src/config/database'),fs=require('node:fs'),path=require('node:path');
(async()=>{const c=await db.getClient();try{await c.query('BEGIN');await c.query(fs.readFileSync(path.join(__dirname,'../src/db/independent-content.sql'),'utf8'));await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await db.end();}})().catch(()=>{console.error('Independent content migration failed');process.exitCode=1;});
