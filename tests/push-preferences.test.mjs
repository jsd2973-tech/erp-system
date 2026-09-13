import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=readFileSync(new URL('../supabase/functions/dispatch-push/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
async function run(title,prefs) {
 let handler; const sent=[]; const writes=[];
 const rows={dispatch_push_config:{worker_token:'test-worker',public_key:'public',private_key:'private'},dispatch_push_devices:{endpoint:'https://fcm.googleapis.com/fake',user_id:'user',session_id:'session',subscription:{}},dispatch_push_notices:{user_id:'user',created_at:new Date().toISOString(),title,body:'original',order_id:'order'},dispatch_push_preferences:prefs};
 const db={from(table){let mutation;const q={select(){return q},eq(){return q},maybeSingle(){return q},single(){return q},update(value){mutation=value;return q},delete(){mutation='delete';return q},then(resolve,reject){if(mutation)writes.push({table,mutation});return Promise.resolve({data:rows[table],error:null}).then(resolve,reject)}};return q},rpc(name){return Promise.resolve({data:name==='dispatch_push_claim'?[{id:'delivery',notice_id:'notice',endpoint:'endpoint'}]:name==='dispatch_push_progress'?'모래 · 누적 34 / 170루베 · 잔여 136루베':true,error:null})}};
 vm.runInNewContext(code,{createClient:()=>db,webpush:{sendNotification:async (_sub,payload)=>{sent.push(JSON.parse(payload))}},Deno:{env:{get:()=> 'https://example.supabase.co'},serve:fn=>handler=fn},Response,Request,URL,atob});
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json','x-push-worker':'test-worker'},body:JSON.stringify({action:'worker'})}));
 assert.equal(response.status,200);return {sent,writes};
}
test('progress remains opt-in for existing accounts',async()=>{const r=await run('운송 잔여 물량',null);assert.equal(r.sent.length,0);assert.equal(r.writes.at(-1).mutation.last_status,204)});
test('enabled progress sends fresh aggregate and saves visible notice',async()=>{const r=await run('운송 잔여 물량',{trip_progress:true});assert.equal(r.sent.length,1);assert.match(r.sent[0].body,/잔여 136루베/);assert.ok(r.writes.some(x=>x.table==='dispatch_push_notices'&&x.mutation.body===r.sent[0].body))});
test('disabled legacy kind suppresses pending delivery',async()=>{const r=await run('새 배차',{new_order:false});assert.equal(r.sent.length,0);assert.ok(!r.writes.some(x=>x.mutation==='delete'))});
