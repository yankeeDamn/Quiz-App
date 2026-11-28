'use strict';
const { transition } = require('./publishing-lifecycle');
const enabled = () => process.env.PUBLISHING_WORKFLOW_ENABLED === 'true';
function requireEnabled() {
  if (!enabled()) throw Object.assign(new Error('Publishing workflow is disabled.'), {statusCode:404});
}
function actorId(user) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user?.id || ''))
    throw Object.assign(new Error('Signed-in administrator required.'), {statusCode:403});
  return user.id;
}
async function event(c, id, action, user) {
  await c.query("INSERT INTO publishing_events(content_type,content_id,action,actor_id) VALUES('study_plan',$1,$2,$3)",[id,action,actorId(user)]);
}
async function schedule(c,p,input,user,ready) {
  requireEnabled();
  if (input?.acknowledged !== true || input.revision !== p.revision)
    throw Object.assign(new Error('Review the current revision and explicitly acknowledge publication.'),{statusCode:409});
  const result = transition({current:'draft',target:'scheduled',publishAt:input.publishAt,ready});
  await c.query("INSERT INTO publishing_jobs(content_type,content_id,expected_revision,publish_at,requested_by) VALUES('study_plan',$1,$2,$3,$4) ON CONFLICT(content_type,content_id) DO UPDATE SET expected_revision=EXCLUDED.expected_revision,publish_at=EXCLUDED.publish_at,requested_by=EXCLUDED.requested_by",[p.id,p.revision,result.publishAt,actorId(user)]);
  await event(c,p.id,'schedule',user);
  return result;
}
async function cancel(c,id,user) {
  const result=await c.query("DELETE FROM publishing_jobs WHERE content_type='study_plan' AND content_id=$1",[id]);
  if(result.rowCount) await event(c,id,'cancel',user);
}
async function published(c,p,user,snapshot) {
  await c.query("INSERT INTO publishing_versions(content_type,content_id,revision,snapshot) VALUES('study_plan',$1,$2,$3)",[p.id,p.revision,JSON.stringify(snapshot)]);
  await c.query("DELETE FROM publishing_jobs WHERE content_type='study_plan' AND content_id=$1",[p.id]);
  await event(c,p.id,'publish',user);
}
module.exports={enabled,requireEnabled,schedule,cancel,published,event};
