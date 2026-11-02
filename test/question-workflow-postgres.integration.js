'use strict';
// Actual SQL verification only against the explicit disposable CI database.
const test=require('node:test'),assert=require('node:assert/strict');
const {Pool}=require('pg');
if(!process.env.EBOOK_TEST_DATABASE_URL)throw Error('EBOOK_TEST_DATABASE_URL must target a disposable test database');
const db=require('../src/config/database'),workflow=require('../src/services/question-workflow.service');
const pool=new Pool({connectionString:process.env.EBOOK_TEST_DATABASE_URL});
let client,original;
const id='11111111-1111-4111-8111-111111111111';
const row=async()=>(await client.query('SELECT * FROM mock_questions WHERE id=$1',[id])).rows[0];
test.before(async()=>{
 client=await pool.connect();
 await client.query(`CREATE TEMP TABLE mock_questions(id UUID PRIMARY KEY,position INT,question TEXT,options JSONB,answer INT,explanation TEXT,difficulty TEXT,active BOOLEAN,review_status TEXT,reviewed_at TIMESTAMPTZ,reviewed_by TEXT,access_tier TEXT,updated_at TIMESTAMPTZ DEFAULT NOW())`);
 await client.query(`INSERT INTO mock_questions(id,position,question,options,answer,explanation,difficulty,active,review_status,access_tier)
 VALUES($1,0,'Synthetic SQL question: choose label A.','["Label A","Label B","Label C","Label D"]',0,'Synthetic rationale: A is the first label.','Easy',true,'draft','premium')`,[id]);
 original=db.getClient;db.getClient=async()=>({query:client.query.bind(client),release(){}});
});
test.after(async()=>{db.getClient=original;if(client){await client.query('DROP TABLE IF EXISTS pg_temp.mock_questions');client.release();}await pool.end();});
test('real PostgreSQL records acknowledged review and publication atomically',async()=>{
 const before=await row();const result=await workflow.apply(id,{action:'review_publish',revision:workflow.revision(before),acknowledged:true},'owner@example.test');
 assert.equal(result.question.review_status,'published');assert.ok(result.question.reviewed_at instanceof Date);
 const saved=await row();assert.equal(saved.reviewed_by,'owner@example.test');assert.equal(saved.access_tier,'premium');
 assert.equal(result.question.revision,workflow.revision(saved));
});
test('real PostgreSQL rejects stale approval and resets review after explicit access change',async()=>{
 const before=await row();await client.query('UPDATE mock_questions SET explanation=$2 WHERE id=$1',[id,'A changed synthetic explanation.']);
 await assert.rejects(workflow.apply(id,{action:'review_publish',revision:workflow.revision(before),acknowledged:true},'other@example.test'),e=>e.statusCode===409);
 const changed=await row();assert.equal(changed.reviewed_by,'owner@example.test');
 const result=await workflow.apply(id,{action:'access',revision:workflow.revision(changed),tier:'free'},'owner@example.test');
 assert.equal(result.question.review_status,'draft');assert.equal(result.question.reviewed_at,null);
 assert.equal((await row()).reviewed_by,null);
 await assert.rejects(workflow.apply(id,{action:'publish',revision:result.question.revision},'owner@example.test'),e=>e.statusCode===409);
});
