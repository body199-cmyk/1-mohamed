import {describe,it,expect} from 'vitest';
import {renderOperationalReportHtml} from '../src/render-report-html';
import {createOperationalReportXlsxParts} from '../src/render-report-xlsx';
import {paginateOperationalReportForPdf} from '../src/render-report-pdf';
import {createOperationalReportImageLayout} from '../src/render-report-image';
import {assertOperationalReportDocument} from '../src/report-document-validation';
import type {OperationalReportDocument} from '../src/document-types';
const doc:OperationalReportDocument={businessName:'أحمد',title:'شغل المقاول',subtitle:'دفعات العربيات مستقلة',generatedAtLabel:'2026',metadata:[],summarySections:[],columns:[{label:'قيمة الشغل',widthWeight:1}],rows:Array.from({length:16},(_,i)=>[i%2?'على أحمد':'لأحمد']),rowTones:Array.from({length:16},(_,i)=>i%2?'debit':'credit'),emptyMessage:'فارغ',footerNotes:[]};
describe('report direction is carried to exports',()=>{
 it('HTML and XLSX retain green/red meaning without changing row values',()=>{const html=renderOperationalReportHtml(doc);expect(html).toContain('#166534');expect(html).toContain('#991b1b');const parts=createOperationalReportXlsxParts(doc);const sheet=parts.find(p=>p.name.endsWith('sheet2.xml'))!.content;expect(sheet).toContain('s="2"');expect(sheet).toContain('s="3"');expect(sheet).toContain('على أحمد');});
 it('PDF pagination slices tones with rows; PNG layout receives same tone sequence',()=>{const pages=paginateOperationalReportForPdf(doc);expect(pages[1].rowTones).toEqual(doc.rowTones!.slice(14));expect(createOperationalReportImageLayout(pages[1]).rowTones).toEqual(pages[1].rowTones);});
 it('rejects missing and arbitrary style data before export',()=>{expect(()=>assertOperationalReportDocument({...doc,rowTones:['credit']})).toThrow();expect(()=>assertOperationalReportDocument({...doc,rowTones:Array(16).fill('javascript:bad')})).toThrow();});
});
