import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditorDrafts,rangeNumber,positionAtPointer} from '../public/lib/card-editor-workspace.js';

test('switching designs retains separate equipment, undo history and browsing state without sharing references',()=>{
 const drafts=createEditorDrafts();
 const first={equipment:{border:'ouroboros',baseCard:{crop:{x:30}}},baseline:'saved one',history:{undo:['one'],redo:[]},view:{target:'symbols',pickers:{border:{expanded:true,rarity:'rare',scroll:150}}}};
 drafts.set(0,first);first.equipment.baseCard.crop.x=99;first.history.undo.push('outside');
 drafts.set(1,{equipment:{border:'malachite'},baseline:'saved two',history:{undo:[],redo:['two']}});
 const restored=drafts.get(0);assert.equal(restored.equipment.baseCard.crop.x,30);assert.deepEqual(restored.history.undo,['one']);assert.equal(restored.view.pickers.border.scroll,150);
 restored.equipment.border='naval';restored.view.target='finish';assert.equal(drafts.get(0).equipment.border,'ouroboros');assert.equal(drafts.get(0).view.target,'symbols');assert.deepEqual(drafts.get(1).history.redo,['two']);
 drafts.delete(0);assert.equal(drafts.has(0),false);assert.equal(drafts.get(0),null);assert.equal(drafts.has(1),true);
});

test('object dragging preserves the grabbed point across changed bounds, zoom and page movement',()=>{
 const position={x:50,y:50},pointer={x:160,y:240},grab={x:10,y:8};
 // A formerly wide row now has compact content bounds at the provisional position.
 assert.deepEqual(positionAtPointer(position,pointer,grab,{left:220,top:300},{width:200,height:400}),{x:15,y:33});
 // Same object under a doubled card scale; no motion produces no offset.
 assert.deepEqual(positionAtPointer(position,pointer,grab,{left:150,top:232},{width:400,height:800}),position);
 // A moving page/card must still keep the object at the current pointer.
 assert.deepEqual(positionAtPointer(position,pointer,grab,{left:110,top:312},{width:400,height:800}),{x:60,y:40});
 assert.deepEqual(positionAtPointer(position,{x:999,y:-999},grab,{left:0,top:0},{width:200,height:400}),{x:100,y:0});
});

test('numeric range companions reject empty input and clamp and snap values to the real control bounds',()=>{
 for(const raw of ['', ' ', 'invalid',Infinity])assert.equal(rangeNumber(raw,0,100,.1),null);
 assert.equal(rangeNumber('203',25,200,1),200);assert.equal(rangeNumber('-90',0,100,.1),0);
 assert.equal(rangeNumber('12.26',0,100,.1),12.3);assert.equal(rangeNumber('1.87',.5,2,.1),1.9);
 assert.equal(rangeNumber('-179.6',-180,180,1),-180);assert.equal(rangeNumber('137',50,200,10),140);
});
