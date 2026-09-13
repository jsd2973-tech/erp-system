import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './push.css';

export async function disableDevicePush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  // Unsubscribe locally even if the server cannot be reached during logout.
  await subscription.unsubscribe();
  await supabase.functions.invoke('dispatch-push', { body: { action: 'unsubscribe', endpoint: subscription.endpoint } });
}

type Notice = { id: string; title: string; body: string; created_at: string; order_id: string | null };

export default function PushSettings() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [detail, setDetail] = useState<Record<string, string> | null>(null);
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  const open = useCallback(async () => {
    if (!dialog.current?.open) dialog.current?.showModal();
    const { data, error } = await supabase.from('dispatch_push_notices').select('id,title,body,created_at,order_id').order('created_at', { ascending: false }).limit(30);
    if (error) setMessage('알림 내역을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.');
    else setNotices(data || []);
  }, []);

  useEffect(() => {
    const receive = (event: MessageEvent) => { if (event.data?.type === 'ERP_OPEN_NOTIFICATIONS') void open(); };
    const request = () => { void open(); };
    window.addEventListener('ERP_OPEN_NOTIFICATIONS', request);
    navigator.serviceWorker?.addEventListener('message', receive);
    if (new URLSearchParams(location.search).get('push') === '1') void open();
    return () => { window.removeEventListener('ERP_OPEN_NOTIFICATIONS', request); navigator.serviceWorker?.removeEventListener('message', receive); };
  }, [open]);

  const enable = async () => {
    setBusy(true); setMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('브라우저의 사이트 설정에서 알림을 허용해 주세요.');
      const { data: config, error: configError } = await supabase.functions.invoke('dispatch-push', { body: { action: 'config' } });
      if (configError || !config?.publicKey) throw new Error('알림 서버 연결을 확인하지 못했습니다. 다시 시도해 주세요.');
      await navigator.serviceWorker.register('/erp-push-sw.js');
      const registration = await navigator.serviceWorker.ready;
      const old = await registration.pushManager.getSubscription();
      if (old) { await old.unsubscribe(); await supabase.functions.invoke('dispatch-push', { body: { action: 'unsubscribe', endpoint: old.endpoint } }); }
      const encoded = config.publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const applicationServerKey = Uint8Array.from(atob(encoded + '='.repeat((4 - encoded.length % 4) % 4)), c => c.charCodeAt(0));
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const { error, data } = await supabase.functions.invoke('dispatch-push', { body: { action: 'subscribe', subscription: subscription.toJSON() } });
      if (error || data?.error) { await subscription.unsubscribe(); throw new Error('기기 등록에 실패했습니다. 다시 시도해 주세요.'); }
      setMessage('이 휴대폰의 알림 수신을 켰습니다. 테스트 알림으로 확인해 주세요.');
    } catch (error) { setMessage(error instanceof Error ? error.message : '알림을 설정하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true);
    try {
      const subscription = await (await navigator.serviceWorker.getRegistration('/'))?.pushManager.getSubscription();
      if (!subscription) throw new Error('먼저 알림 수신을 켜 주세요.');
      const { error, data } = await supabase.functions.invoke('dispatch-push', { body: { action: 'test', endpoint: subscription.endpoint } });
      if (error || data?.error) throw new Error('테스트 알림 전송에 실패했습니다. 수신 설정을 다시 확인해 주세요.');
      setMessage('테스트 알림을 전송했습니다. 휴대폰 알림함을 확인해 주세요.');
    } catch (error) { setMessage(error instanceof Error ? error.message : '전송에 실패했습니다.'); }
    finally { setBusy(false); }
  };

  return <>
    <dialog ref={dialog} className="erp-push-dialog">
      <header><strong>운행관리 알림</strong><button type="button" onClick={() => dialog.current?.close()}>닫기</button></header>
      <p>새 배차·물량 변경·취소 알림을 이 기기로 받습니다.</p>
      {!supported ? <p>이 브라우저에서는 푸시 알림을 지원하지 않습니다. Chrome 또는 홈 화면에 추가한 웹앱에서 열어 주세요.</p> : <div className="erp-push-actions">
        <button disabled={busy} onClick={() => void enable()}>알림 수신 켜기</button>
        <button disabled={busy} onClick={() => void test()}>내 기기로 테스트</button>
        <button disabled={busy} onClick={async () => { setBusy(true); try { await disableDevicePush(); setMessage('이 기기의 알림 수신을 껐습니다.'); } catch { setMessage('수신 해제에 실패했습니다. 다시 시도해 주세요.'); } finally { setBusy(false); } }}>알림 수신 끄기</button>
      </div>}
      <p role="status">{message}</p>
      {detail && <article><strong>배차 상세</strong><p>{detail.dispatch_date} · {detail.vendor_name}<br />{detail.loading_location} → {detail.unloading_location}<br />{detail.item_name} · {detail.total_volume}루베 · {detail.status}</p><button onClick={() => setDetail(null)}>상세 닫기</button></article>}
      <h3>최근 알림</h3>
      {notices.length === 0 && <p>받은 알림이 없습니다.</p>}
      {notices.map(notice => <article key={notice.id}><strong>{notice.title}</strong><p>{notice.body}</p><time>{new Date(notice.created_at).toLocaleString('ko-KR')}</time>{notice.order_id && <div><button disabled={busy} onClick={async () => { setBusy(true); setDetail(null); const { data, error } = await supabase.from('dispatch_orders').select('dispatch_date,vendor_name,loading_location,unloading_location,item_name,total_volume,status').eq('id', notice.order_id!).maybeSingle(); if (error || !data) setMessage('배차를 조회할 수 없습니다. 삭제되었거나 조회 권한이 없을 수 있습니다.'); else setDetail(data as unknown as Record<string, string>); setBusy(false); }}>배차 상세 보기</button></div>}</article>)}
    </dialog>
  </>;
}
