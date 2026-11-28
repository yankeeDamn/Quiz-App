'use strict';
const db = require('../config/database');
const store = require('./publishing-store');
const plans = require('./study-plans.service');
async function runDue({database=db,service=plans,logger}={}) {
  if (!store.enabled()) return {published:0,blocked:0};
  const {rows}=await database.query("SELECT j.content_id,j.expected_revision,j.requested_by,u.email FROM publishing_jobs j LEFT JOIN users u ON u.id=j.requested_by WHERE j.content_type='study_plan' AND j.publish_at<=now() ORDER BY j.publish_at LIMIT 25");
  let published=0,blocked=0;
  for(const job of rows) {
    try {
      await service.publish({id:job.requested_by,email:job.email},job.content_id,{revision:job.expected_revision,acknowledged:true,scheduled:true});
      published++;
    } catch(error) {
      blocked++;
      // Keep blocked jobs for explicit review; do not silently change the draft.
      // No raw errors or account identifiers in worker logs.
      logger?.warn({contentId:job.content_id,status:error.statusCode||500},'Scheduled study plan blocked');
    }
  }
  return {published,blocked};
}
function startPublishingWorker(logger) {
  if(!store.enabled()) return async()=>{};
  let running=null;
  const tick=()=>{if(!running)running=runDue({logger}).catch(()=>logger.warn('Publishing worker could not load queue')).finally(()=>{running=null;});};
  const timer=setInterval(tick,60000);timer.unref();
  tick();
  return async()=>{clearInterval(timer);await running;};
}
module.exports={runDue,startPublishingWorker};
