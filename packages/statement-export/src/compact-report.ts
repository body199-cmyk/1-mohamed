import type {OperationalReportDocument,OperationalReportDetailSection} from './document-types';
import type {OperationalReportImageLayout} from './render-report-image';
const LEFT=80,RIGHT=1360,SPAN=1280,BLUE='#2446ad',INK='#172b45',MUTED='#526171';
const COLORS={credit:'#147344',debit:'#b3343c',neutral:BLUE};
type Table=OperationalReportDetailSection&{top:number;heights:number[];widths:number[];total?:string};
export interface CompactReportLayout extends OperationalReportImageLayout {readonly compactTables:readonly Table[];readonly compactFooter:number;}
/** Deterministic wrapping means export layout never depends on viewport or theme. */
export function reportLines(text:string,width:number,size=26):string[]{
 const max=Math.max(2,Math.floor(width/(size*.64)));const lines:string[]=[];
 for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){
  if(!word)continue;if(line&&line.length+word.length+1>max){lines.push(line);line='';}
  if(word.length>max){if(line){lines.push(line);line='';}for(let i=0;i<word.length;i+=max){const part=word.slice(i,i+max);if(part.length===max)lines.push(part);else line=part;}}
  else line+=(line?' ':'')+word;
 }if(line||!lines.length)lines.push(line);}
 return lines;
}
function widths(table:OperationalReportDetailSection){const sum=table.columns.reduce((n,c)=>n+c.widthWeight,0);return table.columns.map(c=>SPAN*c.widthWeight/sum);}
function tableHeight(table:OperationalReportDetailSection){const w=widths(table);return (table.rows.length?table.rows:[[table.emptyMessage]]).map(row=>Math.max(78,24+Math.max(...row.map((v,i)=>table.columns[i]?.direction==='ltr'?1:reportLines(v,(w[i]??SPAN)-24).length))*37));}
export function createCompactReportLayout(doc:OperationalReportDocument,options:{fixedHeight?:number;pageLabel?:string}):CompactReportLayout {
 const metadataRows=Math.ceil(doc.metadata.length/3);
 const summaryStart=234+metadataRows*66;let y=summaryStart;
 doc.summarySections.forEach((section,i)=>{y+=i===0?Math.ceil(section.metrics.length/4)*132+20:44+Math.ceil(section.metrics.length/4)*70+18;});
 const tables:Table[]=[];
 const all=[{title:doc.detailsTitle??'تفاصيل التقرير',columns:doc.columns,rows:doc.rows,emptyMessage:doc.emptyMessage,rowTones:doc.rowTones},...(doc.detailSections??[])];
 for(const [i,t] of all.entries()){const heights=tableHeight(t);const total=i===0?doc.detailsTotal:undefined;tables.push({...t,top:y,heights,widths:widths(t),total});y+=62+62+heights.reduce((a,b)=>a+b,0)+36+(total?64:0);}
 const compactFooter=y+10;
 const contentBottom=compactFooter+doc.footerNotes.reduce((n,t)=>n+reportLines(t,SPAN,23).length*34+10,0)+80;
 const height=options.fixedHeight??Math.max(1000,contentBottom);
 if(height>8192||height<contentBottom||(options.fixedHeight!==undefined&&options.fixedHeight!==2036))throw new Error('التقرير أطول من مساحة الصورة أو صفحة PDF؛ اختر فترة أقصر أو استخدم CSV/Excel. لن تُحذف أي حركة.');
 return {...doc,width:1440,height,summaryStart,tableTitleY:tables[0]!.top,headerY:tables[0]!.top+62,rowsTop:tables[0]!.top+124,pageLabel:options.pageLabel,compactTables:tables,compactFooter};
}
function text(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,size=26,color=INK,bold=false,width=SPAN,ltr=false){
 ctx.font=`${bold?700:400} ${size}px Cairo, Tahoma, Arial, sans-serif`;ctx.textAlign='right';ctx.textBaseline='alphabetic';ctx.fillStyle=color;ctx.direction=ltr?'ltr':'rtl';
 // Isolate numeric amount from currency and surrounding Arabic.
 if(ltr&&value.endsWith(' ج.م')){const number=value.slice(0,-4);ctx.fillText(number,x,y,width);const used=Math.min(ctx.measureText(number).width,width-44);ctx.direction='rtl';ctx.fillText('ج.م',x-used-8,y,42);}else ctx.fillText(value,x,y,width);
}
function rule(ctx:CanvasRenderingContext2D,y:number,color='#d9e0e7',thickness=1){ctx.fillStyle=color;ctx.fillRect(LEFT,y,SPAN,thickness);}
export function paintCompactReport(ctx:CanvasRenderingContext2D,layout:CompactReportLayout){
 ctx.fillStyle='#fff';ctx.fillRect(0,0,1440,layout.height);
 ctx.font='700 40px Cairo';ctx.textAlign='center';ctx.direction='rtl';ctx.fillStyle=BLUE;ctx.fillText(layout.businessName,720,76,SPAN);
 ctx.font='700 32px Cairo';ctx.fillStyle=INK;ctx.fillText(layout.title,720,128,SPAN);
 ctx.font='400 22px Cairo';ctx.fillStyle=MUTED;ctx.fillText(layout.subtitle,720,169,SPAN);
 ctx.font='400 19px Cairo';ctx.fillText('تاريخ الإعداد: '+layout.generatedAtLabel,720,207,SPAN);rule(ctx,225,BLUE,5);
 layout.metadata.forEach((m,i)=>{const x=RIGHT-(i%3)*(SPAN/3);const y=260+Math.floor(i/3)*66;text(ctx,m.label,x,y,20,MUTED,false,400);text(ctx,m.value,x,y+31,25,INK,true,400,m.direction==='ltr');});
 let y=layout.summaryStart;
 layout.summarySections.forEach((section,s)=>{
  if(s>0){text(ctx,section.title,RIGHT,y+28,23,INK,true);y+=44;}
  const columns=Math.min(4,Math.max(1,section.metrics.length));const cell=SPAN/columns;
  section.metrics.forEach((m,i)=>{const x=RIGHT-(i%columns)*cell;const row=Math.floor(i/columns);const top=y+row*(s===0?132:70);const tone=m.tone??'neutral';
   if(s===0){ctx.fillStyle=tone==='credit'?'#effaf3':tone==='debit'?'#fff3f3':'#f1f6ff';ctx.fillRect(x-cell+10,top,cell-20,114);ctx.strokeStyle=tone==='credit'?'#69ac84':tone==='debit'?'#d17d83':'#7c98d2';ctx.lineWidth=2;ctx.strokeRect(x-cell+10,top,cell-20,114);
    text(ctx,m.label,x-26,top+36,23,MUTED,false,cell-52);text(ctx,m.value,x-26,top+85,37,COLORS[tone],true,cell-52,m.direction==='ltr');
   }else {text(ctx,m.label,x-12,top+23,21,MUTED,false,cell-24);text(ctx,m.value,x-12,top+57,28,INK,true,cell-24,m.direction==='ltr');}
  });y+=s===0?Math.ceil(section.metrics.length/4)*132+20:Math.ceil(section.metrics.length/4)*70+18;
 });
 for(const t of layout.compactTables){text(ctx,t.title,RIGHT-16,t.top+37,29,INK,true);ctx.fillStyle=BLUE;ctx.fillRect(RIGHT-5,t.top+8,5,35);ctx.fillRect(LEFT,t.top+62,SPAN,62);
  let x=RIGHT;t.columns.forEach((c,i)=>{text(ctx,c.label,x-12,t.top+102,23,'#fff',true,t.widths[i]!-24);x-=t.widths[i]!;});
  let rowY=t.top+124;const rows=t.rows.length?t.rows:[[t.emptyMessage]];
  rows.forEach((row,i)=>{const h=t.heights[i]!;ctx.fillStyle=i%2?'#f5f7fa':'#fff';ctx.fillRect(LEFT,rowY,SPAN,h);let right=RIGHT;
   if(!t.rows.length)text(ctx,t.emptyMessage,RIGHT-18,rowY+48,26,MUTED,false,SPAN-36);
   else row.forEach((v,j)=>{const col=t.columns[j]!;const color=t.rowTones?.[i]?COLORS[t.rowTones[i]!]:(j===row.length-1?BLUE:INK);const lines=col.direction==='ltr'?[v]:reportLines(v,t.widths[j]!-24);lines.forEach((line,k)=>text(ctx,line,right-12,rowY+42+k*37,26,color,j===row.length-1,t.widths[j]!-24,col.direction==='ltr'));right-=t.widths[j]!;});
   rule(ctx,rowY+h-1);rowY+=h;
  });
  if(t.total){ctx.fillStyle='#eef3fb';ctx.fillRect(LEFT,rowY,SPAN,64);text(ctx,t.total,RIGHT-18,rowY+42,25,BLUE,true,SPAN-36);}
 }
 rule(ctx,layout.compactFooter-10);
 let footY=layout.compactFooter+29;for(const note of layout.footerNotes){for(const line of reportLines(note,SPAN,23)){text(ctx,line,RIGHT,footY,23,MUTED,false);footY+=34;}footY+=10;}
 if(layout.pageLabel)text(ctx,layout.pageLabel,RIGHT,layout.height-28,21,MUTED);
}
