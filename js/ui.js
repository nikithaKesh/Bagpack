(() => {
  const C=window.BAGPACK_CONFIG;
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const icon=(name)=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  function applyTheme(theme){
    const t=theme==='light'?'light':'dark';
    document.documentElement.dataset.theme=t;
    localStorage.setItem(C.STORAGE.theme,t);
    const use=$('#themeIconUse'), btn=$('#themeToggleBtn');
    if(use)use.setAttribute('href',t==='dark'?'#i-sun':'#i-moon');
    if(btn)btn.setAttribute('aria-label',t==='dark'?'Switch to light mode':'Switch to dark mode');
  }

  function enhanceSelect(select){
    if(!select || select.multiple || select.classList.contains('status-native') || select.dataset.enhanced==='1')return;
    select.dataset.enhanced='1';
    select.classList.add('select-native-hidden');
    const wrap=document.createElement('div');wrap.className='select-ui';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='select-ui-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');menu.className='select-ui-menu hidden';menu.setAttribute('role','listbox');
    select.parentNode.insertBefore(wrap,select);wrap.appendChild(select);wrap.appendChild(trigger);wrap.appendChild(menu);

    const refresh=()=>{
      const current=select.options[select.selectedIndex];
      trigger.innerHTML=`<span>${current?.textContent||'Select'}</span>${icon('chevron-down')}`;
      menu.innerHTML=[...select.options].map(o=>`<button type="button" role="option" aria-selected="${o.selected}" class="select-ui-option ${o.selected?'active':''}" data-value="${encodeURIComponent(o.value)}">${o.textContent}</button>`).join('');
    };
    select._bagpackRefresh=refresh;
    trigger.addEventListener('click',()=>{
      const opening=menu.classList.contains('hidden');
      $$('.select-ui-menu').forEach(m=>{if(m!==menu)m.classList.add('hidden')});
      menu.classList.toggle('hidden',!opening);trigger.setAttribute('aria-expanded',String(opening));
    });
    menu.addEventListener('click',e=>{
      const o=e.target.closest('.select-ui-option');if(!o)return;
      select.value=decodeURIComponent(o.dataset.value);select.dispatchEvent(new Event('change',{bubbles:true}));menu.classList.add('hidden');trigger.setAttribute('aria-expanded','false');refresh();
    });
    select.addEventListener('change',refresh);
    new MutationObserver(refresh).observe(select,{childList:true,subtree:true,attributes:true});
    refresh();
  }
  function refreshSelects(){
    $$('select').forEach(enhanceSelect);
    $$('.select-ui select').forEach(s=>s._bagpackRefresh?.());
  }
  document.addEventListener('click',e=>{
    if(!e.target.closest('.select-ui'))$$('.select-ui-menu').forEach(m=>m.classList.add('hidden'));
  });
  document.addEventListener('DOMContentLoaded',()=>{
    applyTheme(localStorage.getItem(C.STORAGE.theme)||'dark');
    $('#themeToggleBtn')?.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
    refreshSelects();
  });
  window.BagpackUI={refreshSelects,applyTheme};
})();