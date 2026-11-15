/** Consistent presentation-only navigation icons. */
export function WorkspaceIcon({name}:{name:string}){
 const paths:Record<string,string>={
  home:'m3 10 9-7 9 7v10H3zM9 20v-7h6v7',
  entry:'M3 6h11v11H3zM14 10h4l3 4v3h-7M7 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4M18 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  reports:'M4 4h16v17H4zM8 2v4M16 2v4M4 9h16M8 13h3M14 13h3M8 17h3',
  contractor:'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',
  cash:'M3 6h18v13H3zM3 10h18M6 15h4M16 14h2',
  master:'M4 3h6v6H4zM14 3h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  settings:'M4 7h16M4 17h16M8 4v6M16 14v6',
 };
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]??paths.home}/></svg>;
}
