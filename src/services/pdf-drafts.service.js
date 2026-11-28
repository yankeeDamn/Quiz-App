'use strict';
const db=require('../config/database');
const {PDFDocument}=require('pdf-lib');
const {createPdfPreview,MAX_PDF_BYTES}=require('./ebook-pdf-preview');
const fields='id,title,category,filename,page_count,revision,updated_at,octet_length(bytes) AS size_bytes';
const fail=(message,statusCode=400)=>{throw Object.assign(Error(message),{statusCode});};
function enabled(){if(process.env.INDEPENDENT_CONTENT_ENABLED!=='true')fail('Independent content is disabled.',404);}
function id(value){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||''))fail('Invalid identifier.');return value;}
function clean(value,max){if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail('Required text exceeds its limit or is empty.');return value.trim();}
function revision(value){if(!Number.isSafeInteger(value)||value<1)fail('Invalid revision.');return value;}
async function list(){enabled();return (await db.query('SELECT '+fields+' FROM content_pdf_drafts ORDER BY updated_at DESC,id LIMIT 200')).rows;}
async function create(input){enabled();return (await db.query('INSERT INTO content_pdf_drafts(title,category) VALUES($1,$2) RETURNING '+fields,[clean(input?.title,180),clean(input?.category,100)])).rows[0];}
async function update(key,input){enabled();const r=await db.query('UPDATE content_pdf_drafts SET title=$2,category=$3,revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$4 RETURNING '+fields,[id(key),clean(input?.title,180),clean(input?.category,100),revision(input?.revision)]);if(!r.rowCount)fail('Draft changed or is missing. Reload first.',409);return r.rows[0];}
async function upload(key,rev,bytes){enabled();id(key);revision(rev);if(!Buffer.isBuffer(bytes)||bytes.length>MAX_PDF_BYTES||bytes.length<8||bytes.subarray(0,5).toString()!=='%PDF-')fail('Choose a PDF of at most 3 MiB.');let pages,preview;try{pages=(await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false})).getPageCount();preview=await createPdfPreview(bytes,1);}catch{fail('Invalid or encrypted PDF.');}const r=await db.query("UPDATE content_pdf_drafts SET bytes=$2,preview_bytes=$3,page_count=$4,filename='resource.pdf',revision=revision+1,updated_at=now() WHERE id=$1 AND revision=$5 RETURNING "+fields,[key,bytes,preview,pages,rev]);if(!r.rowCount)fail('Draft changed or is missing. Reload first.',409);return r.rows[0];}
async function preview(key){enabled();const r=await db.query('SELECT preview_bytes FROM content_pdf_drafts WHERE id=$1',[id(key)]);if(!r.rows[0]?.preview_bytes)fail('No PDF preview.',404);return r.rows[0].preview_bytes;}
module.exports={list,create,update,upload,preview};
