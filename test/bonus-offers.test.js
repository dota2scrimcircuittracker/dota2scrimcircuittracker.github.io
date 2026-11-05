import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markPackOffer,availablePackOffers,syncPackOfferClaims,setPackOfferSignedIn} from '../public/lib/bonus-offers.js';

test('server claims clear stale browser offers and hide action badges',()=>{
  const originals={localStorage:globalThis.localStorage,document:globalThis.document,dispatchEvent:globalThis.dispatchEvent};
  const values=new Map(),badges={feedback:{},tour:{},discord:{}};
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  globalThis.document={querySelectorAll:selector=>[badges[/data-offer-badge="(\w+)"/.exec(selector)[1]]]};
  globalThis.dispatchEvent=()=>{};
  try {
    markPackOffer('tour');markPackOffer('discord');
    assert.deepEqual(availablePackOffers({}),['tour','discord']);
    syncPackOfferClaims({bonusPackClaims:{tour:true,discord:true}});
    assert.deepEqual(availablePackOffers({}),[]);
    assert.equal(badges.tour.hidden,true);assert.equal(badges.discord.hidden,true);
    markPackOffer('discord');assert.deepEqual(availablePackOffers({}),[]);
    syncPackOfferClaims({bonusPackClaimed:true});assert.equal(badges.feedback.hidden,true);
  }finally{for(const [key,value] of Object.entries(originals))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('feedback badge shows only when signed in',()=>{
  const originals={localStorage:globalThis.localStorage,document:globalThis.document};
  const badges={feedback:{},tour:{},discord:{}};
  globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  globalThis.document={querySelectorAll:selector=>[badges[/data-offer-badge="(\w+)"/.exec(selector)[1]]]};
  try {
    setPackOfferSignedIn(false);
    assert.equal(badges.feedback.hidden,true);assert.equal(badges.tour.hidden,false);
    setPackOfferSignedIn(true);assert.equal(badges.feedback.hidden,false);
    setPackOfferSignedIn(false);assert.equal(badges.feedback.hidden,true);
  }finally{for(const [key,value] of Object.entries(originals))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
