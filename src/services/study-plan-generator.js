'use strict';
function generate({duration,dailyMinutes,resources}) {
 if(!Number.isInteger(duration)||duration<1||duration>365||!Number.isInteger(dailyMinutes)||dailyMinutes<1||dailyMinutes>1440||!Array.isArray(resources)||!resources.length||resources.length>duration)throw Object.assign(Error('Choose 1 to duration resources and valid daily minutes.'),{statusCode:400});
 return Array.from({length:duration},(_,i)=>{
 const r=resources[i%resources.length], revision=i>=resources.length;
 return {day:i+1,title:(revision?'Revise: ':'Read: ')+r.title.slice(0,160),kind:revision?'revision':'reading',minutes:dailyMinutes,display_order:0,required:true,preview:false,resource_id:r.id,topic_id:r.topic_id||null,mock_id:null,description:''};
 });
}
module.exports={generate};
