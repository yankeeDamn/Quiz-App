'use strict';
const db=require('../config/database');
const fail=(message,statusCode=400)=>{throw Object.assign(Error(message),{statusCode});};
function enabled(){if(process.env.INDEPENDENT_CONTENT_ENABLED!=='true')fail('Independent content is disabled.',404);}
function text(v,max,required=true){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('Invalid certification text.');return v.trim();}
function id(v){if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))fail('Invalid identifier.');return v;}
function ids(v){if(!Array.isArray(v)||v.length>100)fail('Choose up to 100 linked items.');return [...new Set(v.map(id))];}
function validate(input){
 if(!Array.isArray(input?.domains)||input.domains.length>30)fail('Choose up to 30 domains.');
 const seen=new Set();const domains=input.domains.map(d=>{const key=id(d?.id);if(seen.has(key)||!Number.isInteger(d.weight)||d.weight<0||d.weight>100)fail('Invalid domain or weight.');seen.add(key);return {id:key,title:text(d.title,180),weight:d.weight};});
 const total=domains.reduce((n,d)=>n+d.weight,0);if(total>100)fail('Domain weights cannot exceed 100%.');
 return {title:text(input.title,180),exam_code:text(input.exam_code,60),description:text(input.description||'',12000,false),domains,pdf_ids:ids(input.pdf_ids),course_ids:ids(input.course_ids)};
}
async function list(){enabled();return (await db.query('SELECT * FROM content_certification_drafts ORDER BY updated_at DESC,id LIMIT 100')).rows;}
async function save(key,input){
 enabled();const d=validate(input);
 const c=await db.getClient();
 try{await c.query('BEGIN');for(const [table,values] of [['content_pdf_drafts',d.pdf_ids],['content_course_drafts',d.course_ids]]){const r=await c.query('SELECT id FROM '+table+' WHERE id=ANY($1::uuid[]) FOR SHARE',[values]);if(r.rowCount!==values.length)fail('A linked draft does not exist.');}
 const args=[d.title,d.exam_code,d.description,JSON.stringify(d.domains),d.pdf_ids,d.course_ids];let r;
 if(key){id(key);if(!Number.isInteger(input.revision)||input.revision<1)fail('Invalid revision.');r=await c.query('UPDATE content_certification_drafts SET title=$1,exam_code=$2,description=$3,domains=$4::jsonb,pdf_ids=$5,course_ids=$6,revision=revision+1,updated_at=now() WHERE id=$7 AND revision=$8 RETURNING *',[...args,key,input.revision]);}
 else r=await c.query('INSERT INTO content_certification_drafts(title,exam_code,description,domains,pdf_ids,course_ids) VALUES($1,$2,$3,$4::jsonb,$5,$6) RETURNING *',args);
 if(!r.rowCount)fail('Draft changed or missing.',409);await c.query('COMMIT');return r.rows[0];
 }catch(e){await c.query('ROLLBACK');if(e.code==='23505')fail('Exam code already exists.',409);throw e;}finally{c.release();}
}
module.exports={list,save,validate};
