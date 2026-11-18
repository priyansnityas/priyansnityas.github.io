const test=require('node:test');
const assert=require('node:assert/strict');
const assistant=require('../src/ai/experimentalAssistant.js');

test('optional on-device helper is feature detected and proposes reviewable entry fields',async()=>{
  const previous=globalThis.LanguageModel;
  globalThis.LanguageModel={create:async()=>({prompt:async()=>'{"amount":20,"kind":"debit","type":"Daily Expense","note":"tea"}',destroy(){}})};
  try{
    assert.equal(assistant.available(),true);
    assert.deepEqual(await assistant.parseForReview('tea twenty'),{amount:20,kind:'debit',type:'Daily Expense',note:'tea'});
    globalThis.LanguageModel={create:async()=>({prompt:async()=>'not json'})};
    assert.equal(await assistant.parseForReview('unclear text'),null);
  }finally{if(previous===undefined)delete globalThis.LanguageModel;else globalThis.LanguageModel=previous}
});
