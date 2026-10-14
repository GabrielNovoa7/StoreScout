/* Appearance is account-scoped and never contains credentials. */
(() => {
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  let selected={mode:'light',accent:'green'};
  const colors={green:['#235d4c','#88d9b6'],blue:['#2459b8','#9bbfff'],purple:['#7445b3','#d1adff'],orange:['#a34810','#ffb47e'],pink:['#ac326d','#ffa4d0']};
  function apply(profile){
    selected={mode:'light',accent:'green',...profile};
    if(!colors[selected.accent])selected.accent='green';
    const dark=selected.mode==='dark'||selected.mode==='system'&&media.matches;
    const root=document.documentElement;
    root.dataset.theme=dark?'dark':'light';root.dataset.accent=selected.accent;
    root.style.setProperty('--green',colors[selected.accent][dark?1:0]);
    root.style.setProperty('--deep',colors[selected.accent][dark?1:0]);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#141a19':'#f8f9f5');
  }
  media.addEventListener('change',()=>{if(selected.mode==='system')apply(selected);});
  window.ScoutTheme={apply};apply(null);
})();
