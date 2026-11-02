'use strict';
// Explicitly disposable database only; never use a deployment DATABASE_URL here.
const test=require('node:test'),assert=require('node:assert/strict');
const {Pool}=require('pg'),fs=require('node:fs'),path=require('node:path');
if(!process.env.EBOOK_TEST_DATABASE_URL)throw Error('EBOOK_TEST_DATABASE_URL must target a disposable test database');
const pool=new Pool({connectionString:process.env.EBOOK_TEST_DATABASE_URL});
const migration=fs.readFileSync(path.join(__dirname,'../src/db/question-review.sql'),'utf8');
test.after(()=>pool.end());
test('review migration preserves every row, publishes only non-paid live free practice, and is safe twice',async()=>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('CREATE SCHEMA content_review_fixture');
  await client.query('SET LOCAL search_path TO content_review_fixture,public');
  // Simulate the exact pre-upgrade tables, independent of the app database.
  await client.query(`CREATE TABLE mock_topics(id TEXT PRIMARY KEY,active BOOLEAN);
    CREATE TABLE mock_questions(id TEXT PRIMARY KEY,topic_id TEXT,position INT,question TEXT,active BOOLEAN);
    CREATE TABLE mock_tests(id TEXT PRIMARY KEY,tier TEXT,active BOOLEAN,sections JSONB);
    CREATE TABLE practice_question_overrides(source TEXT,question_id TEXT,content JSONB);
    CREATE TABLE practice_question_additions(source TEXT,question_id TEXT,content JSONB);
    INSERT INTO mock_topics VALUES ('live',TRUE),('draft',FALSE);
    INSERT INTO mock_questions VALUES
      ('free','live',0,'Synthetic free fixture',TRUE),
      ('shared','live',1,'Synthetic shared fixture',TRUE),
      ('paid','live',2,'Synthetic paid fixture',TRUE),
      ('draft','draft',0,'Synthetic unpublished fixture',TRUE),
      ('retired','live',3,'Synthetic retired fixture',FALSE);
    INSERT INTO mock_tests VALUES
      ('free','free',TRUE,'[{"parts":[{"topic":"live","from":0,"to":2}]}]'),
      ('paid','premium',FALSE,'[{"parts":[{"topic":"live","from":1,"to":3}]}]');
    INSERT INTO practice_question_overrides VALUES ('homepage','old-free','{}');
    INSERT INTO practice_question_additions VALUES ('homepage','old-free','{}');`);
  await client.query(migration);
  const before=(await client.query('SELECT * FROM mock_questions ORDER BY id')).rows;
  assert.equal(before.length,5,'no deletion');
  assert.deepEqual(before.filter(q=>q.review_status==='published').map(q=>q.id),['free']);
  assert.equal(before.find(q=>q.id==='free').access_tier,'free');
  assert.ok(before.every(q=>q.reviewed_at===null),'grandfathering never invents human review');
  assert.ok(before.filter(q=>q.id!=='free').every(q=>q.review_status==='draft'&&q.access_tier==='premium'));
  await client.query("UPDATE mock_questions SET review_status='draft' WHERE id='free'");
  await client.query("INSERT INTO mock_questions(id,topic_id,position,question,active) VALUES ('new','live',4,'New synthetic fixture',TRUE)");
  await client.query("INSERT INTO practice_question_additions(source,question_id,content) VALUES ('homepage','new-free','{}')");
  await client.query(migration);
  const after=(await client.query('SELECT * FROM mock_questions')).rows;
  assert.equal(after.length,6);assert.ok(after.every(q=>q.review_status==='draft'),'repeat run must not republish withdrawn or new questions');
  assert.equal((await client.query("SELECT review_status FROM practice_question_additions WHERE question_id='new-free'")).rows[0].review_status,'draft');
  assert.equal((await client.query("SELECT review_status FROM practice_question_additions WHERE question_id='old-free'")).rows[0].review_status,'published');
  assert.equal((await client.query('SELECT count(*)::int n FROM content_migrations')).rows[0].n,1);
 }finally{await client.query('ROLLBACK');client.release();}
});
