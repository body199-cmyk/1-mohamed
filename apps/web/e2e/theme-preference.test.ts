import {expect,it} from 'vitest';
import {runInNewContext} from 'node:vm';
import {timeTheme,isThemePreference,THEME_BOOTSTRAP} from '../src/components/theme-preference';
it.each([[0,'dark'],[5,'dark'],[6,'light'],[12,'light'],[17,'light'],[18,'dark'],[23,'dark']])('clock hour %i uses %s', (hour,wanted)=>{
 expect(timeTheme(new Date(2026,10,17,Number(hour),0))).toBe(wanted);
});
it('accepts only the three supported preferences',()=>{
 for(const pref of ['light','dark','auto'])expect(isThemePreference(pref)).toBe(true);
 for(const pref of [null,'system','bad',{},''])expect(isThemePreference(pref)).toBe(false);
});
it.each(['light','dark','auto'])('before-paint bootstrap and provider resolver agree for saved %s',pref=>{
 const document={documentElement:{dataset:{} as Record<string,string>}};
 runInNewContext(THEME_BOOTSTRAP,{document,localStorage:{getItem:()=>pref},Date,matchMedia:()=>({matches:false})});
 expect(document.documentElement.dataset.theme).toBe(pref==='auto'?timeTheme():pref);
 expect(document.documentElement.dataset.themeMode).toBe(pref);
});
