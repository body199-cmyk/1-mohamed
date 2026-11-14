import {expect,it} from 'vitest';
import {wholeHistoryPeriod} from '../src/features/reports/report-period';
import {buildDailyWorkReport} from '../src/features/reports/daily-work-report';
import {INITIAL_TRIPS} from '../src/demo/demo-data';

it('whole history starts at the opening and covers old movements without changing a selected range',()=>{
 expect(wholeHistoryPeriod(['2020-01-02','2026-11-05'],'2021-01-01','2026-11-14'))
  .toEqual({from:'2021-01-01',to:'2026-11-05'});
 expect(wholeHistoryPeriod(['2019-12-31','2026-11-05'],undefined,'2026-11-14'))
  .toEqual({from:'2019-12-31',to:'2026-11-05'});
 expect(wholeHistoryPeriod([],undefined,'2026-11-14')).toEqual({from:'2026-11-14',to:'2026-11-14'});
});
it('whole daily work history keeps contractor and vehicle filters and original totals',()=>{
 const result=buildDailyWorkReport(INITIAL_TRIPS,{workDate:'2026-11-05',contractorId:'K1',vehicleId:'',allHistory:true});
 expect(result.ok).toBe(true);
 if(result.ok){expect(result.rows).toHaveLength(3);expect(result.totals.contractorTotalPiastres).toBe('190000');}
 const filtered=buildDailyWorkReport(INITIAL_TRIPS,{workDate:'2026-11-05',contractorId:'K1',vehicleId:'V1',allHistory:true});
 expect(filtered.ok&&filtered.rows.map(r=>r.id)).toEqual([INITIAL_TRIPS[0].id]);
});
