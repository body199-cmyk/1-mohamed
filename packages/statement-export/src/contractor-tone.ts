/** Presentation only: accept a formatted monetary token, never infer from names or dates. */
export function contractorTone(text: string): { color: string; label: string } {
 if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{2})?(?: ج\.م)?$/.test(text)) return {color:"#475569",label:""};
 const zero = /^[+-]?0+(?:\.00)?(?: ج\.م)?$/.test(text);
 return zero ? {color:"#475569",label:"متعادل"} : text.startsWith("-") ? {color:"#b42318",label:"على أحمد"} : {color:"#116744",label:"لأحمد"};
}
