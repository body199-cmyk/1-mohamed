export type Theme = 'light'|'dark';
export type ThemePreference = Theme|'auto';
export const DAY_START_HOUR=6;
export const NIGHT_START_HOUR=18;
export function timeTheme(date=new Date()):Theme{
 const hour=date.getHours();
 return hour>=DAY_START_HOUR&&hour<NIGHT_START_HOUR?'light':'dark';
}
export function isThemePreference(value:unknown):value is ThemePreference{
 return value==='light'||value==='dark'||value==='auto';
}
/** Fixed source only: apply the saved preference before paint, with no account data. */
export const THEME_BOOTSTRAP=`(()=>{try{let p=localStorage.getItem('theme');if(!['light','dark','auto'].includes(p))p=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';let h=new Date().getHours();document.documentElement.dataset.theme=p==='auto'?(h>=${DAY_START_HOUR}&&h<${NIGHT_START_HOUR}?'light':'dark'):p;document.documentElement.dataset.themeMode=p;}catch{}})();`;
