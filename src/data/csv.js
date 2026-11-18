// Make exported text safe to open in common spreadsheet applications.
(function(root){
  function cell(value){
    const text=String(value??'');
    const protectedText=/^[\s\u0000-\u001f]*[=+@-]/.test(text)?`'${text}`:text;
    return `"${protectedText.replaceAll('"','""')}"`;
  }
  const api={cell};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.PocketLedgerCsv=api;
})(typeof globalThis!=='undefined'?globalThis:this);
