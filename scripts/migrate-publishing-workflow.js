'use strict';
require('dotenv').config();
const fs=require('node:fs');
const path=require('node:path');
const db=require('../src/config/database');
(async()=>{
 const c=await db.getClient();
 try{await c.query('BEGIN');await c.query(fs.readFileSync(path.join(__dirname,'../src/db/publishing-workflow.sql'),'utf8'));await c.query('COMMIT');console.log('Publishing schema installed');}
 catch(e){await c.query('ROLLBACK');throw e;}
 finally{c.release();await db.end();}
})().catch(()=>{console.error('Publishing migration failed');process.exitCode=1;});
