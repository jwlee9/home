((root)=>{
  const rgb=hex=>[0,2,4].map(i=>parseInt(hex.slice(1+i,3+i),16));
  const luminance=channels=>channels.map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const contrast=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  function palette(hex){
    const channels=rgb(hex),lum=luminance(channels);
    // The group unanimous fill mixes in 12% black. Pick an outline against that fill.
    const fill=luminance(channels.map(c=>c*.88));
    const dark='#493500',light='#fff2be';
    return {text:lum>.179?'#000000':'#ffffff',outline:contrast(fill,luminance(rgb(dark)))>contrast(fill,luminance(rgb(light)))?dark:light};
  }
  const api={palette,luminance,contrast,rgb};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.schedulerTheme=api;
})(typeof window!=='undefined'?window:globalThis);
