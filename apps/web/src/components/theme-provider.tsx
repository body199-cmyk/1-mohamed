"use client";
import React,{createContext,useContext,useEffect,useState} from 'react';
import {isThemePreference,timeTheme,type Theme,type ThemePreference} from './theme-preference';

type ThemeContextType={theme:Theme;preference:ThemePreference;setPreference:(value:ThemePreference)=>void;toggleTheme:()=>void};
const ThemeContext=createContext<ThemeContextType>({theme:'light',preference:'light',setPreference:()=>{},toggleTheme:()=>{}});
export function ThemeProvider({children}:{children:React.ReactNode}){
 const [theme,setTheme]=useState<Theme>('light');
 const [preference,setPreferenceState]=useState<ThemePreference>('light');
 const [ready,setReady]=useState(false);
 function apply(value:ThemePreference){
  const resolved=value==='auto'?timeTheme():value;
  setTheme(resolved);document.documentElement.dataset.theme=resolved;document.documentElement.dataset.themeMode=value;
 }
 useEffect(()=>{
  let saved:string|null=null;try{saved=localStorage.getItem('theme');}catch{}
  const initial=isThemePreference(saved)?saved:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  setPreferenceState(initial);apply(initial);setReady(true);
 },[]);
 useEffect(()=>{
  if(!ready||preference!=='auto')return;
  const update=()=>apply('auto');
  const timer=window.setInterval(update,60000);
  window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
  return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
 },[ready,preference]);
 useEffect(()=>{
  const changed=(event:StorageEvent)=>{
   if(event.key!=='theme'||!isThemePreference(event.newValue))return;
   setPreferenceState(event.newValue);apply(event.newValue);
  };
  window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
 },[]);
 function setPreference(value:ThemePreference){
  setPreferenceState(value);apply(value);
  try{localStorage.setItem('theme',value);}catch{}
 }
 return <ThemeContext.Provider value={{theme,preference,setPreference,toggleTheme:()=>setPreference(theme==='light'?'dark':'light')}}>{children}</ThemeContext.Provider>;
}
export function useTheme(){return useContext(ThemeContext);}
