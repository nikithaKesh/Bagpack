(() => {
  const C=window.BAGPACK_CONFIG;
  const $=s=>document.querySelector(s);
  function download(name,content,type){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function snapshot(){
    return {
      version:1,
      exportedAt:new Date().toISOString(),
      items, categories, collections, notes,
      settings:{vaultLocalOnly:localStorage.getItem(C.STORAGE.vaultLocalOnly)!=='0'}
    };
  }
  function exportJSON(){
    download(`bagpack-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(snapshot(),null,2),'application/json');
    window.notify?.('JSON backup downloaded','success','Backup');
  }
  function csvCell(v){const s=Array.isArray(v)?v.join('; '):String(v??'');return `"${s.replace(/"/g,'""')}"`}
  function exportCSV(){
    const cols=['id','title','url','type','category','subcategory','theme','status','tags','note','pinned','favorite','createdAt','lastOpenedAt','openCount'];
    const rows=[cols.join(','),...items.map(i=>cols.map(c=>csvCell(i[c])).join(','))];
    download(`bagpack-links-${new Date().toISOString().slice(0,10)}.csv`,rows.join('\n'),'text/csv;charset=utf-8');
    window.notify?.('CSV export downloaded','success','Backup');
  }
  async function importBackup(file){
    const raw=JSON.parse(await file.text());
    if(!raw || !Array.isArray(raw.items)) throw new Error('This is not a valid Bagpack backup.');
    items=raw.items.map(normalizeItemShape);
    categories=Array.isArray(raw.categories)?raw.categories:categories;
    collections=Array.isArray(raw.collections)?raw.collections:collections;
    notes=Array.isArray(raw.notes)?raw.notes.map(normalizeNote):notes;
    save();renderAll();
    window.notify?.(`Restored ${items.length} records`,'success','Backup restored');
  }
  async function resetWithBackup(){
    if(!confirm('Reset local edits and return to the packaged library? A recovery snapshot will be kept in this browser.')) return;
    localStorage.setItem(C.STORAGE.resetBackup,JSON.stringify(snapshot()));
    localStorage.removeItem(LS_ITEMS);localStorage.removeItem(LS_CATS);localStorage.removeItem(LS_COLLECTIONS);localStorage.removeItem(LS_NOTES);
    await dbClear();location.reload();
  }
  async function undoReset(){
    const raw=localStorage.getItem(C.STORAGE.resetBackup);if(!raw)return;
    try{
      const data=JSON.parse(raw);items=data.items.map(normalizeItemShape);categories=data.categories;collections=data.collections;notes=data.notes.map(normalizeNote);
      save();localStorage.removeItem(C.STORAGE.resetBackup);renderAll();refreshUndo();
      window.notify?.('Previous local state restored','success','Reset undone');
    }catch{window.notify?.('Recovery snapshot could not be restored','error')}
  }
  function refreshUndo(){const b=$('#undoResetBtn');if(b)b.classList.toggle('hidden',!localStorage.getItem(C.STORAGE.resetBackup))}
  document.addEventListener('DOMContentLoaded',()=>{
    $('#exportJsonBtn')?.addEventListener('click',exportJSON);
    $('#exportCsvBtn')?.addEventListener('click',exportCSV);
    $('#importBackupBtn')?.addEventListener('click',()=>$('#backupFileInput')?.click());
    $('#backupFileInput')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{await importBackup(f)}catch(err){window.notify?.(err.message,'error','Restore failed')}e.target.value=''});
    $('#undoResetBtn')?.addEventListener('click',undoReset);
    refreshUndo();
  });
  window.BagpackBackup={exportJSON,exportCSV,resetWithBackup,undoReset};
})();