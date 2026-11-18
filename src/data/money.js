// Store monetary math as integer paise while preserving the app's rupee data format.
(function(root){
  const toMinor=value=>{
    const number=Number(value);
    if(!Number.isFinite(number))return 0;
    return Math.round((number+Number.EPSILON)*100);
  };
  const fromMinor=value=>Number((Number(value||0)/100).toFixed(2));
  const add=(left,right)=>fromMinor(toMinor(left)+toMinor(right));
  const sum=values=>fromMinor(values.reduce((total,value)=>total+toMinor(value),0));
  const api={toMinor,fromMinor,add,sum};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.PocketLedgerMoney=api;
})(typeof globalThis!=='undefined'?globalThis:this);
