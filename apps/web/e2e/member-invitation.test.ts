import {beforeEach,expect,it,vi} from 'vitest';
import {inviteMember,type InvitationDependencies} from '../../../supabase/functions/invite-member/core';
let deps:InvitationDependencies;
beforeEach(()=>{deps={isOwner:vi.fn(async()=>true),findTarget:vi.fn(async()=>null),isActive:vi.fn(async()=>false),invite:vi.fn(async()=> 'member-id'),grant:vi.fn(async()=>{}),recovery:vi.fn(async()=>{}),generate:vi.fn(async()=>({id:'generated-id',url:'https://fixture.test/invite'}))};});
const request=(body:unknown={email:'NEW@example.com'})=>new Request('https://fixture.test',{method:'POST',body:JSON.stringify(body)});
it('sends an Auth invitation then grants the returned identity, normalizing email',async()=>{
 const r=await inviteMember(request(),deps);expect(r.status).toBe(200);
 expect(deps.invite).toHaveBeenCalledWith('new@example.com');expect(deps.grant).toHaveBeenCalledWith('member-id','new@example.com');
});
it('unprivileged callers cannot trigger any privileged action',async()=>{
 vi.mocked(deps.isOwner).mockResolvedValue(false);
 expect((await inviteMember(request(),deps)).status).toBe(403);expect(deps.invite).not.toHaveBeenCalled();expect(deps.findTarget).not.toHaveBeenCalled();
});
it.each([{},[],{email:'invalid'},{email:'x\ny@test.com'},{email:'a'.repeat(255)+'@test.com'}])('rejects malformed invitation %j',async body=>{
 expect((await inviteMember(request(body),deps)).status).toBe(400);expect(deps.invite).not.toHaveBeenCalled();
});
it('failed email delivery never grants a membership',async()=>{
 vi.mocked(deps.invite).mockRejectedValue(new Error('SMTP failed'));
 expect((await inviteMember(request(),deps)).status).toBe(502);expect(deps.grant).not.toHaveBeenCalled();
});
it('can recover an existing or previously revoked account without replacing its password',async()=>{
 vi.mocked(deps.findTarget).mockResolvedValue('existing-id');
 expect((await inviteMember(request(),deps)).status).toBe(200);expect(deps.recovery).toHaveBeenCalled();expect(deps.grant).toHaveBeenCalledWith('existing-id','new@example.com');expect(deps.invite).not.toHaveBeenCalled();
});
it('duplicate active invitations do not silently resend mail',async()=>{
 vi.mocked(deps.findTarget).mockResolvedValue('existing-id');vi.mocked(deps.isActive).mockResolvedValue(true);
 expect((await inviteMember(request(),deps)).status).toBe(409);expect(deps.recovery).not.toHaveBeenCalled();
 expect((await inviteMember(request({email:'new@example.com',resend:true}),deps)).status).toBe(200);expect(deps.recovery).toHaveBeenCalled();expect(deps.grant).not.toHaveBeenCalled();
});

it('manual links grant only the returned identity and never send email',async()=>{
 const r=await inviteMember(request({email:'new@example.com',mode:'link'}),deps);
 expect(r.status).toBe(200);expect((await r.json()).inviteUrl).toBe('https://fixture.test/invite');
 expect(deps.generate).toHaveBeenCalledWith('new@example.com',false);
 expect(deps.grant).toHaveBeenCalledWith('generated-id','new@example.com');expect(deps.invite).not.toHaveBeenCalled();expect(deps.recovery).not.toHaveBeenCalled();
});
