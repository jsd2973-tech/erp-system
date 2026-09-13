import { createClient } from 'npm:@supabase/supabase-js@2.105.3';
import webpush from 'npm:web-push@3.6.7';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-push-worker', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Content-Type': 'application/json' };
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const defaults = {new_order:true,volume_change:true,cancellation:true,trip_progress:false};
const preferenceKeys = Object.keys(defaults);
const kindForTitle = (title:string) => ({'새 배차':'new_order','물량 변경':'volume_change','배차 취소':'cancellation','운송 잔여 물량':'trip_progress'}[title]);
const preferences = async (userId:string) => ({...defaults,...await checked(db.from('dispatch_push_preferences').select('new_order,volume_change,cancellation,trip_progress').eq('user_id',userId).maybeSingle())});
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers});
const checked = async (query: PromiseLike<any>) => { const result = await query; if(result.error) throw result.error; return result.data; };
const allowedEndpoint = (value: unknown) => {
  try { const url=new URL(String(value)); return url.protocol==='https:' && !url.username && !url.password && !url.port && (url.hostname==='fcm.googleapis.com' || url.hostname==='updates.push.services.mozilla.com' || url.hostname.endsWith('.notify.windows.com') || url.hostname==='web.push.apple.com' || url.hostname.endsWith('.push.apple.com')); } catch { return false; }
};
async function config() {
  let row=await checked(db.from('dispatch_push_config').select('*').eq('id',true).maybeSingle());
  if(!row) {
    const keys=webpush.generateVAPIDKeys();
    await checked(db.from('dispatch_push_config').upsert({id:true,public_key:keys.publicKey,private_key:keys.privateKey},{onConflict:'id',ignoreDuplicates:true}));
    row=await checked(db.from('dispatch_push_config').select('*').eq('id',true).single());
  }
  return row;
}
async function send(device:any, cfg:any, id:string, title:string, body:string) {
  if(!allowedEndpoint(device.endpoint)) throw {statusCode:410};
  const valid=await checked(db.rpc('dispatch_push_session_valid',{p_user:device.user_id,p_session:device.session_id}));
  if(!valid) throw {statusCode:410};
  await webpush.sendNotification(device.subscription,JSON.stringify({id,title,body}),{TTL:300,timeout:10000,vapidDetails:{subject:Deno.env.get('SUPABASE_URL')!,publicKey:cfg.public_key,privateKey:cfg.private_key}});
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers});
  if(req.method!=='POST') return reply({error:'Method not allowed'},405);
  try {
    if(Number(req.headers.get('content-length')||0)>16000) return reply({error:'Too large'},413);
    const body=await req.json();
    if(body.action==='worker') {
      // Do not create configuration or reveal it on an unauthenticated request.
      const cfg=await checked(db.from('dispatch_push_config').select('*').eq('id',true).maybeSingle());
      if(!cfg || req.headers.get('x-push-worker')!==cfg.worker_token) return reply({error:'Unauthorized'},401);
      const deliveries=await checked(db.rpc('dispatch_push_claim'));
      await Promise.all(deliveries.map(async (delivery:any)=>{
        let status=201;
        const device=await checked(db.from('dispatch_push_devices').select('*').eq('endpoint',delivery.endpoint).maybeSingle());
        if(!device) return;
        const notice=await checked(db.from('dispatch_push_notices').select('user_id,created_at,title,body,order_id').eq('id',delivery.notice_id).single());
        const prefs=await preferences(device.user_id);
        const kind=kindForTitle(notice.title);
        if(kind && !prefs[kind]) {
          await checked(db.from('dispatch_push_deliveries').update({attempts:5,last_status:204}).eq('id',delivery.id));
          return;
        }
        if(kind==='trip_progress') {
          const summary=await checked(db.rpc('dispatch_push_progress',{p_order_id:notice.order_id}));
          if(!summary) { await checked(db.from('dispatch_push_deliveries').update({attempts:5,last_status:204}).eq('id',delivery.id)); return; }
          notice.body=summary;
          await checked(db.from('dispatch_push_notices').update({body:summary}).eq('id',delivery.notice_id));
        }
        try {
          if(notice.user_id!==device.user_id || Date.now()-Date.parse(notice.created_at)>86400000) throw {statusCode:410};
          await send(device,cfg,delivery.notice_id,notice.title,notice.body);
        } catch(error) { status=Number(error.statusCode)||503; }
        if(status===404 || status===410) await checked(db.from('dispatch_push_devices').delete().eq('endpoint',delivery.endpoint));
        else await checked(db.from('dispatch_push_deliveries').update({last_status:status,...(status===201?{sent_at:new Date().toISOString()}:{})}).eq('id',delivery.id));
      }));
      return reply({processed:deliveries.length});
    }
    const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
    const {data:{user},error}=await db.auth.getUser(token);
    if(error || !user) return reply({error:'Unauthorized'},401);
    const admin=await checked(db.from('dispatch_admin_users').select('user_id').eq('user_id',user.id).maybeSingle());
    const drivers=await checked(db.from('dispatch_drivers').select('id').eq('auth_user_id',user.id).eq('active',true).limit(1));
    if(!admin && !drivers.length) return reply({error:'운행관리 담당 계정만 알림을 받을 수 있습니다.'},403);
    if(body.action==='preferences') return reply({preferences:await preferences(user.id)});
    if(body.action==='save_preferences') {
      const p=body.preferences;
      if(!p || preferenceKeys.some(key=>typeof p[key]!=='boolean')) return reply({error:'Invalid preferences'},400);
      await checked(db.from('dispatch_push_preferences').upsert({user_id:user.id,...Object.fromEntries(preferenceKeys.map(key=>[key,p[key]]))}));
      return reply({ok:true});
    }
    const cfg=await config();
    if(body.action==='config') return reply({publicKey:cfg.public_key});
    if(body.action==='subscribe') {
      const subscription=body.subscription;
      if(!allowedEndpoint(subscription?.endpoint) || !/^[A-Za-z0-9_-]{87}$/.test(subscription?.keys?.p256dh||'') || !/^[A-Za-z0-9_-]{22}$/.test(subscription?.keys?.auth||'')) return reply({error:'Invalid subscription'},400);
      // getUser above validates this JWT before its session claim is used.
      const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const valid=await checked(db.rpc('dispatch_push_session_valid',{p_user:user.id,p_session:claims.session_id}));
      if(!valid) return reply({error:'Session expired'},401);
      const { count } = await db.from('dispatch_push_devices').select('endpoint',{count:'exact',head:true}).eq('user_id',user.id);
      if((count||0)>=10) return reply({error:'등록 기기 수가 많습니다. 기존 기기에서 수신을 꺼 주세요.'},409);
      const existing=await checked(db.from('dispatch_push_devices').select('user_id').eq('endpoint',subscription.endpoint).maybeSingle());
      if(existing && existing.user_id!==user.id) return reply({error:'기기 수신 설정을 다시 켜 주세요.'},409);
      await checked(db.from('dispatch_push_devices').upsert({endpoint:subscription.endpoint,user_id:user.id,subscription,session_id:claims.session_id}));
      return reply({ok:true});
    }
    if(body.action==='unsubscribe') {
      await checked(db.from('dispatch_push_devices').delete().eq('endpoint',String(body.endpoint)).eq('user_id',user.id));
      return reply({ok:true});
    }
    if(body.action==='test') {
      const device=await checked(db.from('dispatch_push_devices').select('*').eq('endpoint',String(body.endpoint)).eq('user_id',user.id).maybeSingle());
      if(!device) return reply({error:'이 주소의 기기 등록이 없습니다. 알림 수신 켜기를 누른 뒤 다시 테스트해 주세요.'},409);
      const minute=Math.floor(Date.now()/60000);
      const {data:notice,error:insertError}=await db.from('dispatch_push_notices').insert({user_id:user.id,event_key:`test:${minute}`,title:'테스트 알림',body:'이 기기의 푸시 알림 수신을 확인해 주세요.'}).select('id').single();
      if(insertError) return insertError.code==='23505'
        ? reply({error:'테스트 알림은 계정당 1분에 한 번 가능합니다. 잠시 후 다시 눌러 주세요.'},429)
        : reply({error:'테스트 기록 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.'},500);
      try {
        await send(device,cfg,notice.id,'테스트 알림','거래처 · 품목 · 물량이 이 위치에 표시됩니다.');
      } catch(error) {
        const status=Number(error.statusCode)||503;
        if(status===404 || status===410) return reply({error:'기존 알림 구독 또는 로그인 연결이 만료됐습니다. 알림 수신 켜기를 다시 눌러 주세요.'},409);
        if(status===429) return reply({error:'휴대폰 푸시 서비스의 요청 제한입니다. 잠시 후 다시 시도해 주세요.'},429);
        return reply({error:'푸시 서비스 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.'},502);
      }
      return reply({ok:true});
    }
    return reply({error:'Unknown action'},400);
  } catch { return reply({error:'알림 처리에 실패했습니다.'},500); }
});
