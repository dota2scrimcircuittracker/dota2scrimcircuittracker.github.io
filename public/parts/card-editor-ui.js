import {itemByKey} from '../lib/cosmetics-catalog.js';
import {rangeNumber} from '../lib/card-editor-workspace.js';

const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
const button=(text,action)=>{const b=el('button','',text);b.type='button';if(action)b.onclick=action;return b;};
const pressed=(node,value)=>{if(node.getAttribute('aria-pressed')!==String(value))node.setAttribute('aria-pressed',String(value));};
const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
let workspaceSequence=0;

export function mountCardEditorUI({body,card,view={},getState,onUndo,onRedo,onRevert,onDuplicate,onTarget,onCompare,onSettled,onDestroy}){
 const abort=new AbortController(),signal=abort.signal;
 const q=s=>body.querySelector(s),preview=q('[data-card-editor]'),grid=q('.card-editor');
 body.classList.add('editor-workspace');
 const remembered={...view},pickerState={...view.pickers};
 let active=view.target??'none',paused=!!view.paused,comparing=false,dead=false;
 const inspector=el('section','editor-inspector');inspector.setAttribute('aria-label','Selected object adjustments');
 const inspectorTitle=el('strong','','Select something to adjust'),inspectorContent=el('div','editor-inspector-content');
 const dock=el('aside','editor-adjustment-dock');dock.setAttribute('aria-label','Card adjustments and framing');
 inspector.append(inspectorTitle,inspectorContent);dock.append(inspector);grid.append(dock);
 const panel=q('[data-part-panel]'),effects=q('[data-effect-controls]'),signature=q('.image-adjustments:has([data-position])');
 panel.classList.add('editor-object-panel');inspectorContent.append(panel);
 if(effects)inspectorContent.append(effects);
 if(signature){signature.classList.add('editor-signature-adjust');signature.open=true;inspectorContent.append(signature);}
 const hint=el('p','editor-selection-hint','Click an object on the card, or choose a tool above it.');inspectorContent.append(hint);

 // Compact design controls. Keep the existing actions and their server validation.
 const header=el('div','editor-design-header'),designLabel=el('label','','Design'),select=el('select');
 select.setAttribute('aria-label','Card design');
 q('.card-slots').querySelectorAll('[data-card-slot]').forEach(b=>{
  const option=el('option','',b.childNodes[0].textContent.trim()+' · '+b.querySelector('small').textContent);
  option.value=b.dataset.cardSlot;option.dataset.label=option.textContent;option.selected=b.getAttribute('aria-pressed')==='true';option.disabled=b.disabled;select.append(option);
 });
 select.onchange=()=>q(`[data-card-slot="${select.value}"]`).click();designLabel.append(select);header.append(designLabel);
 const preferences=q('.card-preferences'),nameForm=q('[data-slot-name]');
 if(nameForm){nameForm.classList.add('editor-inline-name');nameForm.querySelector('button').textContent='Rename';nameForm.querySelector('label').firstChild.textContent='Name ';nameForm.querySelector('input').setAttribute('aria-label','Design name');header.append(nameForm);}
 const options=el('details','editor-design-options'),summary=el('summary','','Design options');options.append(summary);
 if(preferences){options.append(preferences);preferences.classList.add('editor-preferences');}
 const nickname=q('[data-name-editor]');if(nickname)options.append(nickname);
 header.append(options);q('.card-slots').hidden=true;grid.before(header);

 const actionbar=el('div','editor-actionbar'),status=el('span','editor-save-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const undo=button('Undo',onUndo),redo=button('Redo',onRedo),revert=button('Revert to saved',onRevert),duplicate=button('Duplicate',onDuplicate),save=q('[data-save]');
 undo.title='Undo (Ctrl+Z)';redo.title='Redo (Ctrl+Shift+Z)';duplicate.title='Copy this draft to an empty design slot';
 actionbar.append(status,undo,redo,duplicate,revert,save);header.append(actionbar);
 const oldBar=q('.editor-savebar');
 for(const type of ['border','finish']){
  const tuning=el('div','editor-material-tuning');
  for(const key of type==='border'?['borderSpeed']:['particleSpeed','particleAmount']){const label=q(`[data-tune-control="${key}"]`);if(label)tuning.append(label);}
  const groups=q(`[data-particle-controls="${type}"]`);if(groups)tuning.append(groups);
  q(`.visual-style-options:has([data-style-choice="${type}"])`).append(tuning);
 }
 oldBar.remove();
 const siteHeader=document.querySelector('header.top');
 const measure=()=>{const pinned=siteHeader&&['sticky','fixed'].includes(getComputedStyle(siteHeader).position);body.style.setProperty('--editor-top',`${pinned?Math.ceil(siteHeader.getBoundingClientRect().height)+8:8}px`);body.style.setProperty('--editor-bar-height',`${Math.ceil(header.getBoundingClientRect().height)}px`);};
 const sizing=new ResizeObserver(measure);if(siteHeader)sizing.observe(siteHeader);sizing.observe(header);window.addEventListener('resize',measure,{signal});measure();

 const previewTools=el('div','editor-preview-tools');
 const front=button('Front',()=>flip(false)),back=button('Back',()=>flip(true)),pause=button('Pause animation',()=>{paused=!paused;motion();});
 const compare=button('Hold to compare');compare.title='Hold to see the last saved version';
 const zoom=el('select');zoom.setAttribute('aria-label','Preview size');
 for(const [value,label]of [['fit','Fit'],['large','Large']]){const o=el('option','',label);o.value=value;zoom.append(o);}zoom.value=view.zoom??'fit';zoom.onchange=()=>preview.dataset.previewSize=zoom.value;preview.dataset.previewSize=zoom.value;
 previewTools.append(front,back,pause,compare);const previewHeading=preview.querySelector('.editor-preview-heading');previewHeading.append(zoom);previewHeading.after(previewTools);
 function flip(value){card.classList.toggle('flipped',value);pressed(front,!value);pressed(back,value);}
 function motion(){card.toggleAttribute('data-preview-paused',paused);pause.textContent=paused?'Resume animation':'Pause animation';pressed(pause,paused);document.dispatchEvent(new Event('card-preview-motion'));}
 function compareTo(value){if(comparing===value)return;comparing=value;card.classList.toggle('editor-comparing',value);pressed(compare,value);compare.textContent=value?'Saved version':'Hold to compare';onCompare(value);}
 compare.onpointerdown=e=>{if(e.button!==0||compare.disabled)return;e.preventDefault();compare.setPointerCapture(e.pointerId);compareTo(true);};
 compare.onpointerup=compare.onpointercancel=()=>compareTo(false);
 compare.onlostpointercapture=()=>compareTo(false);
 compare.onkeydown=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();compareTo(true);}};
 compare.onkeyup=e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();compareTo(false);}};
 compare.onblur=()=>compareTo(false);
 window.addEventListener('blur',()=>compareTo(false),{signal});

 const targets={artwork:'Artwork',signature:'Signature',finish:'Finish',symbols:'Symbols',text:'Text'};
 const tools=el('div','editor-target-tools');tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Edit card object');
 for(const [key,label]of Object.entries(targets)){const b=button(label,()=>selectTarget(key,true));b.dataset.editorTool=key;tools.append(b);}previewTools.after(tools);
 function selectTarget(target,invoke=false,selection){
  active=target;card.dataset.editorMode=target;inspector.dataset.target=target;
  dock.hidden=target==='none';
  for(const b of tools.children)pressed(b,b.dataset.editorTool===target);
  inspectorTitle.textContent=targets[target]?`Adjust ${targets[target].toLowerCase()}`:'Select something to adjust';
  card.classList.toggle('sig-selected',target==='signature');
  if(invoke)onTarget(target,selection);refresh();
 }
 card.addEventListener('pointerdown',e=>{
  if(comparing||card.classList.contains('flipped'))return;
  const target=e.target.closest('.finish-position-handle')?'finish':e.target.closest('.cosmetic-emblem,.emblem-wheel')?'symbols':e.target.closest('.card-autograph,.sig-wheel:not(.part-wheel)')?'signature':e.target.closest('[data-part],.part-wheel')?'text':'artwork';
  const symbol=e.target.closest('.cosmetic-emblem'),part=e.target.closest('[data-part]');
  selectTarget(target,target!==active,symbol?[...card.querySelectorAll('.cosmetic-emblem')].indexOf(symbol):part?.dataset.part);
 },{capture:true,signal});
 body.addEventListener('click',e=>{
  if(e.target.closest('[data-style-choice="finish"]'))selectTarget('finish',true);
  else if(e.target.closest('[data-text-choice="autograph"]'))selectTarget('signature',true);
  else if(active==='symbols'&&e.target.closest('[data-style-choice="border"]'))selectTarget('symbols',true);
 },{signal});

 // Browsing stays on the page. Expanded grids avoid horizontal hunting when desired.
 for(const type of ['border','finish']){
  const field=q(`.visual-style-options:has([data-style-choice="${type}"])`),strip=field.querySelector('.visual-style-strip');
  const picked=el('p','editor-picked-style'),controls=el('div','editor-picker-tools');
  const previous=button('‹',()=>strip.scrollBy({left:-250,behavior:'smooth'})),next=button('›',()=>strip.scrollBy({left:250,behavior:'smooth'}));
  previous.setAttribute('aria-label',`Previous ${type} styles`);next.setAttribute('aria-label',`Next ${type} styles`);
  const rarity=el('select');rarity.setAttribute('aria-label',`${type==='border'?'Border':'Finish'} rarity`);
  for(const tier of ['all','common','rare','epic','legendary']){const option=el('option','',tier==='all'?'All rarities':tier[0].toUpperCase()+tier.slice(1));option.value=tier;rarity.append(option);}
  const all=button('Show all',()=>{pickerState[type].expanded=!pickerState[type].expanded;filter();});
  pickerState[type]={expanded:false,rarity:'all',scroll:0,...pickerState[type]};rarity.value=pickerState[type].rarity;
  function filter(){const settings=pickerState[type];settings.rarity=rarity.value;strip.classList.toggle('editor-picker-expanded',settings.expanded);all.textContent=settings.expanded?'Compact view':'Show all';pressed(all,settings.expanded);previous.hidden=next.hidden=settings.expanded;
   for(const choice of strip.children){const item=itemByKey(`${type}:${choice.dataset.choice}`);choice.hidden=settings.rarity!=='all'&&!!item&&item.rarity!==settings.rarity;}
  }
  rarity.onchange=filter;controls.append(previous,next,rarity,all);strip.before(picked,controls);strip.scrollLeft=pickerState[type].scroll;filter();
  if(!view.pickers?.[type]){const selected=strip.querySelector('[aria-pressed=true]');if(selected)strip.scrollLeft=Math.max(0,strip.scrollLeft+selected.getBoundingClientRect().left-strip.getBoundingClientRect().left-strip.clientWidth/2+selected.offsetWidth/2);}
  field.dataset.editorPicker=type;
 }

 // Keep existing range bindings; numeric companions dispatch through those same controls.
 function numbers(){
  for(const range of body.querySelectorAll('.editor-inspector input[type=range],.card-editor-controls input[type=range]')){
   if(range.dataset.numberReady)continue;range.dataset.numberReady='true';
   const label=range.closest('label');if(!label)continue;
   const number=el('input','editor-range-number');number.type='number';number.min=range.min;number.max=range.max;number.step=range.step||'1';number.value=range.value;
   const title=range.getAttribute('aria-label')||label.childNodes[0]?.textContent.trim()||'Value';number.setAttribute('aria-label',title+' value');
   range._editorNumber=number;number.disabled=range.disabled;label.append(number);label.classList.add('editor-number-label');
   const commit=final=>{const value=rangeNumber(number.value,Number(range.min),Number(range.max),range.step);if(value==null){if(final)number.value=range.value;return;}if(!final&&(Number(number.value)<Number(range.min)||Number(number.value)>Number(range.max)))return;range.value=value;if(final)number.value=range.value;range.dispatchEvent(new Event('input',{bubbles:true}));};
   number.oninput=()=>commit(false);number.onchange=number.onblur=()=>commit(true);
  }
 }
 const observer=new MutationObserver(()=>{
  if(dead)return;numbers();refresh();
  const stage=grid.querySelector(':scope>.art-stage');if(stage){dock.prepend(stage);dock.hidden=false;}
 });observer.observe(body,{childList:true,subtree:true});
 body.addEventListener('input',()=>queueMicrotask(()=>{if(!dead)refresh();}),{signal});
 body.addEventListener('pointerup',()=>queueMicrotask(()=>{if(!dead){onSettled();refresh();}}),{signal});
 for(const [i,details]of [...body.querySelectorAll('.card-settings,.image-adjustments')].entries()){
  details.dataset.editorSection=String(i);if(view.sections?.[i]!=null)details.open=view.sections[i];
 }
 // Keep main sections mutually exclusive; nested controls stay independent.
 const appearance=q('.appearance-settings'),treatment=el('details','card-settings editor-treatment-section'),treatmentSummary=el('summary');
 treatmentSummary.append(el('strong','','Card treatment'),el('span','','Borders, finishes, and symbols'));
 appearance.before(treatment);appearance.querySelector(':scope>header')?.remove();treatment.append(treatmentSummary,appearance);
 const mainSections=[...q('.card-editor-controls').querySelectorAll(':scope>.card-settings')];
 const sectionKeys=['artwork','treatment','text','front-layout','back-layout'],sectionGroup=`card-editor-sections-${++workspaceSequence}`;
 const activeSection=Object.hasOwn(view,'activeSection')?view.activeSection:'treatment';
 for(const [i,section]of mainSections.entries()){
  section.dataset.editorAccordion=sectionKeys[i];section.open=false;section.setAttribute('name',sectionGroup);
  if(section.dataset.layoutFace)section.addEventListener('toggle',()=>{if(section.open)flip(section.dataset.layoutFace==='back');},{signal});
 }
 const selectedSection=mainSections.find(section=>section.dataset.editorAccordion===activeSection);if(selectedSection)selectedSection.open=true;
 function refresh(){
  if(dead||!card.isConnected)return;
  const s=getState(),dirty=JSON.stringify(s.equipment)!==s.baseline||!s.hasSaved;
  text(status,s.busy?'Saving…':dirty?'Unsaved changes':'Saved');status.classList.toggle('is-dirty',dirty);card.toggleAttribute('inert',s.busy);
  undo.disabled=!s.editable||s.busy||!s.history.undo.length;redo.disabled=!s.editable||s.busy||!s.history.redo.length;
  revert.disabled=!s.editable||s.busy||!dirty;duplicate.disabled=!s.editable||s.busy||!s.canDuplicate;
  text(revert,s.hasSaved?'Revert to saved':'Discard draft');
  save.disabled=!s.editable||s.busy||!dirty;compare.disabled=!s.hasSaved||(!dirty&&!comparing);
  for(const option of select.options)text(option,option.dataset.label+(s.dirtySlots?.includes(Number(option.value))||(option.selected&&dirty)?' · Draft':''));
  for(const b of tools.children)b.disabled=!s.editable||s.busy;
  for(const field of body.querySelectorAll('[data-editor-picker]')){const type=field.dataset.editorPicker;const pickedName=itemByKey(`${type}:${s.equipment[type]}`)?.name??(type==='finish'?'No finish':'Default grey');const target=field.querySelector('.editor-picked-style');if(target.textContent!==pickedName)target.textContent=pickedName;}
  for(const range of body.querySelectorAll('input[data-number-ready]'))if(range._editorNumber){range._editorNumber.disabled=range.disabled;if(document.activeElement!==range._editorNumber)range._editorNumber.value=range.value;}
  hint.hidden=active==='signature'?s.equipment.autograph!=='none':active==='finish'?!!effects?.textContent.trim():!panel.hidden;
  text(hint,active==='signature'?'Choose a signature style to position it.':active==='finish'?'Choose a finish with placement controls.':active==='symbols'?'Click a symbol on the card, or add one from Appearance.':'Click an object on the card, or choose a tool above it.');
 }
 function capture(){
  for(const field of body.querySelectorAll('[data-editor-picker]'))pickerState[field.dataset.editorPicker].scroll=field.querySelector('.visual-style-strip').scrollLeft;
  return {...remembered,target:active,selection:active==='text'?panel.dataset.for:active==='symbols'?panel.dataset.symbolIndex:null,paused,back:card.classList.contains('flipped'),zoom:zoom.value,pickers:structuredClone(pickerState),activeSection:mainSections.find(section=>section.open)?.dataset.editorAccordion??null,sections:Object.fromEntries([...body.querySelectorAll('[data-editor-section]')].map(d=>[d.dataset.editorSection,d.open]))};
 }
 numbers();flip(!!view.back);motion();selectTarget(active,false);refresh();
 if(active!=='none')onTarget(active,view.selection);
 return {refresh,select:selectTarget,capture,destroy(){dead=true;observer.disconnect();sizing.disconnect();abort.abort();onDestroy?.();if(comparing)onCompare(false);}};
}
