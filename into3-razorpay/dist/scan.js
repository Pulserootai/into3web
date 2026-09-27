(() => {
 const button=document.querySelector('.scan-motion'),visual=document.querySelector('.scan-image-wrap');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let paused=reduced.matches;
 function render(){visual.classList.toggle('scan-paused',paused);button.textContent=paused?'Play animation':'Pause animation';button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'Play scan animation':'Pause scan animation');}
 button.addEventListener('click',()=>{paused=!paused;render();});
 reduced.addEventListener('change',e=>{if(e.matches){paused=true;render();}});render();
 const moments={
 stuck:['A repeated wrong step.','The same mistake appears again, and the student asks for help.','Ask before assuming.','Responses and available session signals prompt a check-in: which part felt unclear?','Try a different example.','RTAE recommends a simpler explanation. The personal planner approves; the learning module delivers it.','A fresh question helps check whether the concept is clearer.'],
 tired:['The pace has slowed.','Longer pauses appear and the student says they feel tired.','Confirm how they feel.','A slowdown alone does not prove fatigue. The student’s feedback helps put it in context.','Make room for a reset.','RTAE recommends a pause or suitable reset activity. The personal planner decides how it fits.','After the pause, check readiness before resuming the learning activity.'],
 ready:['They can explain it.','Independent answers and the student’s explanation show understanding of the current step.','Check transfer, not just recall.','Consider whether the learner can apply the idea to a different problem.','Offer a fresh challenge.','RTAE recommends a new application. The planner approves the next activity and level.','Use the new response to decide whether to move ahead or revisit the concept.']
 };
 const fields=['moment-observe-title','moment-observe','moment-context-title','moment-context','moment-action-title','moment-action','moment-check'];
 document.querySelectorAll('[data-moment]').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('[data-moment]').forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;});
  fields.forEach((id,i)=>document.getElementById(id).textContent=moments[tab.dataset.moment][i]);
  const panel=document.getElementById('moment-panel');panel.setAttribute('aria-labelledby',tab.id);panel.classList.remove('moment-enter');void panel.offsetWidth;if(!reduced.matches)panel.classList.add('moment-enter');
 }));
})();