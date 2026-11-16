import {describe,it,expect} from 'vitest';
import {emptyOpening,parseQuickOpening} from '../src/features/ledger/quick-opening-fields';
describe('quick opening signs and validation',()=>{
 it('does not add an opening unless explicitly requested',()=>expect(parseQuickOpening('vehicle',emptyOpening())).toBeUndefined());
 it('vehicle opening is positive and scoped to its responsible contractor',()=>{
  expect(parseQuickOpening('vehicle',{...emptyOpening(),enabled:true,amount:'١٠٠٠',date:'2026-11-01',contractorId:'C1'})).toEqual({date:'2026-11-01',signedPiastres:'100000',contractorId:'C1'});
 });
 it('contractor credit is negative from Ahmed perspective and contractor debit positive',()=>{
  const value={...emptyOpening(),enabled:true,amount:'1000',date:'2026-11-01'};
  expect(parseQuickOpening('contractor',{...value,direction:'OWED_TO_CONTRACTOR'})?.signedPiastres).toBe('-100000');
  expect(parseQuickOpening('contractor',{...value,direction:'OWED_TO_AHMED'})?.signedPiastres).toBe('100000');
 });
 it('requires explicit direction, date and vehicle account',()=>{
  const value={...emptyOpening(),enabled:true,amount:'1000',date:'2026-11-01'};
  expect(()=>parseQuickOpening('contractor',value)).toThrow();expect(()=>parseQuickOpening('vehicle',value)).toThrow();
  expect(()=>parseQuickOpening('vehicle',{...value,date:'',contractorId:'C1'})).toThrow();
 });
 for(const amount of ['-1','0','0.01','1.001','9223372036854775808'])it('rejects invalid/negative/zero opening '+amount,()=>{
  expect(()=>parseQuickOpening('vehicle',{...emptyOpening(),enabled:true,amount,date:'2026-11-01',contractorId:'C1'})).toThrow();
 });
});
