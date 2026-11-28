'use strict';
const db=require('../config/database');
const fail=(message,statusCode=400)=>{throw Object.assign(Error(message),{statusCode});};
function enabled(){if(process.env.INDEPENDENT_CONTENT_ENABLED!=='true')fail('Independent content is disabled.',404);}
function str(v,max,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail('Invalid course text.');return v.trim();}
function id(v){if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))fail('Invalid identifier.');return v;}
function validate(input){
 const title=str(input?.title,180,true),description=str(input?.description||'',12000),level=input?.level;
 if(!['beginner','intermediate','advanced'].includes(level)||!Array.isArray(input?.modules)||input.modules.length>50)fail('Invalid level or module list.');
 const seen=new Set();const unique=v=>{const key=id(v);if(seen.has(key))fail('Duplicate curriculum identifier.');seen.add(key);return key;};
 let total=0;
 const modules=input.modules.map(m=>{
 if(!m||!Array.isArray(m.lessons)||m.lessons.length>100)fail('Invalid lesson list.');
 return {id:unique(m.id),title:str(m.title,180,true),lessons:m.lessons.map(l=>{
 if(++total>300||!l||!['reading','rich_text','link','video','quiz','pdf'].includes(l.kind)||!Number.isInteger(l.minutes)||l.minutes<1||l.minutes>1440||typeof l.preview!=='boolean')fail('Invalid lesson.');
 let content=str(l.content||'',12000);
 if(['link','video'].includes(l.kind)&&content){try{const url=new URL(content);if(url.protocol!=='https:'||url.username||url.password)throw Error();}catch{fail('Use a valid HTTPS link.');}}
 if(l.kind==='pdf'&&content)id(content);
 if(l.kind==='quiz'&&content&&!/^[a-z0-9-]{1,60}$/.test(content))fail('Use an existing mock identifier.');
 return {id:unique(l.id),title:str(l.title,180,true),kind:l.kind,minutes:l.minutes,preview:l.preview,content};
 })};
 });
 return {title,description,level,modules};
}
async function list(){enabled();return (await db.query('SELECT id,title,description,level,revision,modules,updated_at FROM content_course_drafts ORDER BY updated_at DESC,id LIMIT 100')).rows;}
async function save(key,input){
 enabled();const d=validate(input);let result;
 if(key){id(key);if(!Number.isInteger(input.revision)||input.revision<1)fail('Invalid revision.');result=await db.query('UPDATE content_course_drafts SET title=$2,description=$3,level=$4,modules=$5::jsonb,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$6 RETURNING *',[key,d.title,d.description,d.level,JSON.stringify(d.modules),input.revision]);}
 else result=await db.query('INSERT INTO content_course_drafts(title,description,level,modules) VALUES($1,$2,$3,$4::jsonb) RETURNING *',[d.title,d.description,d.level,JSON.stringify(d.modules)]);
 if(!result.rowCount)fail('Draft changed or missing. Reload first.',409);return result.rows[0];
}
module.exports={list,save,validate};
