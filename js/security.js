(() => {
  const C = window.BAGPACK_CONFIG;
  let pinResolver = null;

  function appGateInit(){
    const gate = document.getElementById('appGate');
    const form = document.getElementById('appPinForm');
    const input = document.getElementById('appPinInput');
    const error = document.getElementById('appPinError');
    if(!gate || !form) return;
    const unlocked = sessionStorage.getItem(C.STORAGE.appUnlocked) === '1';
    gate.classList.toggle('unlocked', unlocked);
    document.body.classList.toggle('app-locked', !unlocked);
    if(!unlocked) setTimeout(()=>input?.focus(),80);
    form.addEventListener('submit', e=>{
      e.preventDefault();
      if(input.value === C.APP_PIN){
        sessionStorage.setItem(C.STORAGE.appUnlocked,'1');
        gate.classList.add('unlocked');
        document.body.classList.remove('app-locked');
        error.textContent='';
        input.value='';
      } else {
        error.textContent='Incorrect PIN';
        gate.querySelector('.pin-gate-card')?.classList.remove('shake');
        requestAnimationFrame(()=>gate.querySelector('.pin-gate-card')?.classList.add('shake'));
        input.select();
      }
    });
  }

  function requestPin(scope='Private Vault'){
    const dialog=document.getElementById('pinDialog');
    const form=document.getElementById('pinDialogForm');
    const input=document.getElementById('pinDialogInput');
    const error=document.getElementById('pinDialogError');
    const title=document.getElementById('pinDialogTitle');
    const copy=document.getElementById('pinDialogCopy');
    if(!dialog) return Promise.resolve(false);
    title.textContent=`Unlock ${scope}`;
    copy.textContent=`Enter your Bagpack PIN to continue.`;
    input.value='';error.textContent='';
    dialog.showModal();
    setTimeout(()=>input.focus(),50);
    return new Promise(resolve=>{
      pinResolver=resolve;
      const submit=(e)=>{
        e.preventDefault();
        if(input.value===C.APP_PIN){
          cleanup();dialog.close();resolve(true);
        } else {
          error.textContent='Incorrect PIN';input.select();
        }
      };
      const cancel=()=>{cleanup();dialog.close();resolve(false)};
      const cleanup=()=>{
        form.removeEventListener('submit',submit);
        document.getElementById('pinDialogCancel')?.removeEventListener('click',cancel);
        pinResolver=null;
      };
      form.addEventListener('submit',submit);
      document.getElementById('pinDialogCancel')?.addEventListener('click',cancel);
    });
  }

  window.BagpackSecurity={requestPin};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',appGateInit);
  else appGateInit();
})();