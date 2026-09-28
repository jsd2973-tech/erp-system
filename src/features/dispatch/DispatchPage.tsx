import TransportResults from "./TransportResults";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CirclePlay, CircleCheckBig, Boxes, ArrowUp, ArrowDown } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import DispatchList from "./DispatchList";
import DispatchRegister from "./DispatchRegister";
import DispatchBasics from "./DispatchBasics";
import DriverManagement from "./DriverManagement";
import DriverStatusDashboard from "./DriverStatusDashboard";
import VehicleManagement from "./VehicleManagement";
import type { DispatchMasterImportResult, DriverImportRow, VehicleImportRow } from "./DispatchMasterImport";
import type { DispatchCustomer, DispatchDriver, DispatchItem, DispatchLocation, DispatchLocationType, DispatchOrder, DispatchOrderForm, DispatchOrderVehicle, DispatchOrderWithVehicles, DispatchTrip, DispatchTripLocation, DispatchVehicle, DispatchView } from "./dispatchTypes";
import { createDispatchId, dispatchToday, toPositiveNumber, calculateEstimatedTrips, normalizeCompanyName, normalizeVehicleNumber } from "./dispatchUtils";
import {
  normalizeDispatchCustomer,
  normalizeDispatchDriver,
  normalizeDispatchItem,
  normalizeDispatchLocation,
  normalizeDispatchOrderVehicle,
  normalizeDispatchOrderWithVehicles,
  normalizeDispatchTrip,
  normalizeDispatchTripLocation,
  normalizeDispatchVehicle,
  summarizeDispatchOverview,
} from "./dispatchModel";
import {
  deleteDispatchOrder,
  insertDispatchCustomer,
  insertDispatchDriver,
  insertDispatchItem,
  insertDispatchLocations,
  insertDispatchVehicle,
  loadDispatchPageData,
  permanentlyDeleteDispatchOrder,
  restoreDispatchOrder,
  saveDispatchOrderWithAssignments,
  updateDispatchDriver,
  updateDispatchVehicleCompany,
  upsertDispatchCustomer,
  upsertDispatchDriver,
  upsertDispatchItem,
  upsertDispatchLocation,
  upsertDispatchVehicle,
} from "./dispatchService";
import "./dispatch.css";

// COMPANY_DISPATCH_ASSIGNMENTS_PATCH_V1

type DispatchPageProps = {
  view: DispatchView;
  supabase: SupabaseClient;
  isAdmin: boolean;
  allowedViews: DispatchView[];
  onNavigate: (view: DispatchView) => void;
  onNotify: (message: string) => void;
};

const viewLabels: Record<DispatchView, string> = {
  dispatch_register: "배차등록",
  dispatch_list: "배차목록",
  dispatch_status: "운행현황",
  dispatch_results: "운송실적",
  dispatch_vehicles: "차량관리",
  dispatch_drivers: "기사관리",
  dispatch_basics: "배차 기초관리",
};

const normalizedMasterName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");

export default function DispatchPage({ view, supabase, isAdmin, allowedViews, onNavigate, onNotify }: DispatchPageProps) {
  const [vehicles, setVehicles] = useState<DispatchVehicle[]>([]);
  const [drivers, setDrivers] = useState<DispatchDriver[]>([]);
  const [customers, setCustomers] = useState<DispatchCustomer[]>([]);
  const [locations, setLocations] = useState<DispatchLocation[]>([]);
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [orders, setOrders] = useState<DispatchOrderWithVehicles[]>([]);
  const [deletedOrders, setDeletedOrders] = useState<DispatchOrderWithVehicles[]>([]);
  const [trips, setTrips] = useState<DispatchTrip[]>([]);
  const [tripLocations, setTripLocations] = useState<DispatchTripLocation[]>([]);
  const [editingOrder, setEditingOrder] = useState<DispatchOrderWithVehicles | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState("");
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);

  const canReadOrders = isAdmin || allowedViews.some((item) => ["dispatch_register", "dispatch_list", "dispatch_status", "dispatch_results"].includes(item));
  const canReadTrips = canReadOrders;
  const canReadVehicles = isAdmin || allowedViews.some((item) => ["dispatch_register", "dispatch_list", "dispatch_status", "dispatch_results", "dispatch_vehicles", "dispatch_drivers"].includes(item));
  const canReadDrivers = isAdmin || allowedViews.some((item) => ["dispatch_register", "dispatch_list", "dispatch_status", "dispatch_drivers"].includes(item));
  const canReadMasters = isAdmin || allowedViews.some((item) => ["dispatch_register", "dispatch_basics"].includes(item));

  const loadDispatchData = useCallback(async () => {
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) setInitialLoading(true);
    else setRefreshing(true);
    setError("");

    const { vehicles: vehicleResult, drivers: driverResult, orders: orderResult, assignments: assignmentResult, customers: customerResult, locations: locationResult, items: itemResult, trips: tripResult, tripLocations: tripLocationResult } = await loadDispatchPageData(supabase, {
      vehicles: canReadVehicles,
      drivers: canReadDrivers,
      orders: canReadOrders,
      masters: canReadMasters,
      trips: canReadTrips,
    });

    const requestedErrors = [
      canReadVehicles ? vehicleResult.error : null,
      canReadDrivers ? driverResult.error : null,
      canReadOrders ? orderResult.error : null,
      canReadOrders ? assignmentResult.error : null,
      canReadMasters ? customerResult.error : null,
      canReadMasters ? locationResult.error : null,
      canReadMasters ? itemResult.error : null,
      canReadTrips ? tripResult.error : null,
      canReadTrips ? tripLocationResult.error : null,
    ].filter(Boolean);
    if (requestedErrors.length) {
      setError(`허용된 운행관리 자료 중 일부를 불러오지 못했습니다. 기존 화면 자료와 입력값은 유지됩니다. (${requestedErrors[0]?.message || "조회 오류"})`);
    }

    if (canReadVehicles && !vehicleResult.error && vehicleResult.data) {
      setVehicles(vehicleResult.data.map((row) => normalizeDispatchVehicle(row)));
    }

    if (canReadDrivers && !driverResult.error && driverResult.data) {
      setDrivers(driverResult.data.map((row) => normalizeDispatchDriver(row)));
    }

    if (canReadMasters) {
      if (!customerResult.error && customerResult.data) setCustomers(customerResult.data.map((row) => normalizeDispatchCustomer(row)));
      if (!locationResult.error && locationResult.data) setLocations(locationResult.data.map((row) => normalizeDispatchLocation(row)));
      if (!itemResult.error && itemResult.data) setItems(itemResult.data.map((row) => normalizeDispatchItem(row)));
    }

    if (canReadOrders && !orderResult.error && !assignmentResult.error && orderResult.data && assignmentResult.data) {
      const assignments = assignmentResult.data.map((row) => normalizeDispatchOrderVehicle(row));
      const assignmentMap = new Map<string, DispatchOrderVehicle[]>();
      assignments.forEach((assignment) => assignmentMap.set(assignment.order_id, [...(assignmentMap.get(assignment.order_id) || []), assignment]));
      const normalizedOrders = orderResult.data.map((row) => normalizeDispatchOrderWithVehicles(row, assignmentMap.get(String(row.id)) || []));
      setOrders(normalizedOrders.filter((order) => !order.deleted_at));
      if (isAdmin) setDeletedOrders(normalizedOrders.filter((order) => Boolean(order.deleted_at)));
    }

    if (canReadTrips && !tripResult.error && tripResult.data) {
      setTrips(tripResult.data.map((row) => normalizeDispatchTrip(row)));
    }

    if (canReadTrips && !tripLocationResult.error && tripLocationResult.data) {
      setTripLocations(tripLocationResult.data.map((row) => normalizeDispatchTripLocation(row)));
    }

    hasLoadedRef.current = true;
    setInitialLoading(false);
    setRefreshing(false);
  }, [supabase, isAdmin, canReadVehicles, canReadDrivers, canReadOrders, canReadMasters, canReadTrips]);

  useEffect(() => { void loadDispatchData(); }, [loadDispatchData]);

  const saveVehicle = async (vehicle: DispatchVehicle) => {
    setSaving(true);
    const payload = { id: vehicle.id || createDispatchId(), vehicle_number: normalizeVehicleNumber(vehicle.vehicle_number), company_name: normalizeCompanyName(vehicle.company_name), active: vehicle.active, memo: vehicle.memo };
    const { error: saveError } = await upsertDispatchVehicle(supabase, payload);
    setSaving(false);
    if (saveError) {
      setError(saveError.code === "23505" ? "이미 등록된 차량번호입니다." : `차량 저장 실패: ${saveError.message}`);
      return false;
    }
    await loadDispatchData();
    onNotify(vehicle.id ? "차량정보를 수정했습니다." : "차량을 등록했습니다.");
    return true;
  };

  const saveDriver = async (driver: DispatchDriver) => {
    setSaving(true);
    const existingDriver = driver.id ? drivers.find((item) => item.id === driver.id) : undefined;
    const authUserId = isAdmin ? driver.auth_user_id : (existingDriver?.auth_user_id ?? null);
    const payload = { id: driver.id || createDispatchId(), name: driver.name, phone: driver.phone, company_name: normalizeCompanyName(driver.company_name), assigned_vehicle_id: driver.assigned_vehicle_id, auth_user_id: authUserId, active: driver.active, memo: driver.memo };
    const { error: saveError } = await upsertDispatchDriver(supabase, payload);
    setSaving(false);
    if (saveError) {
      setError(saveError.code === "23505" ? "이미 다른 기사에게 연결된 로그인 User UUID입니다." : `기사 저장 실패: ${saveError.message}`);
      return false;
    }
    await loadDispatchData();
    onNotify(driver.id ? "기사정보를 수정했습니다." : "기사를 등록했습니다.");
    return true;
  };

  const importVehicles = async (rows: VehicleImportRow[]): Promise<DispatchMasterImportResult> => {
    setSaving(true);
    setError("");
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let conflicts = 0;
    let failed = false;
    const existingByNumber = new Map(vehicles.map((vehicle) => [normalizeVehicleNumber(vehicle.vehicle_number).toLocaleLowerCase("ko-KR"), vehicle]));
    for (const row of rows) {
      const vehicleNumber = normalizeVehicleNumber(row.vehicle_number);
      const companyName = normalizeCompanyName(row.company_name);
      if (!vehicleNumber || !companyName) { skipped += 1; continue; }
      const existing = existingByNumber.get(vehicleNumber.toLocaleLowerCase("ko-KR"));
      if (existing) {
        if (existing.company_name && normalizeCompanyName(existing.company_name) !== companyName) { conflicts += 1; continue; }
        if (existing.company_name) { skipped += 1; continue; }
        const { error: updateError } = await updateDispatchVehicleCompany(supabase, existing.id, companyName);
        if (updateError) { setError("차량 " + vehicleNumber + " 보완 실패: " + updateError.message); failed = true; break; }
        updated += 1;
      } else {
        const { error: insertError } = await insertDispatchVehicle(supabase, { id: createDispatchId(), vehicle_number: vehicleNumber, company_name: companyName, active: true, memo: "" });
        if (insertError) { setError("차량 " + vehicleNumber + " 등록 실패: " + insertError.message); failed = true; break; }
        inserted += 1;
      }
    }
    setSaving(false);
    await loadDispatchData();
    if (!failed) onNotify("차량 가져오기 완료 · 신규 " + inserted + "건 · 보완 " + updated + "건");
    return { inserted, updated, skipped, conflicts };
  };

  const importDrivers = async (rows: DriverImportRow[]): Promise<DispatchMasterImportResult> => {
    setSaving(true);
    setError("");
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let conflicts = 0;
    let failed = false;
    const phoneKey = (value: string) => value.replace(/[^0-9]/g, "");
    const normalizedName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
    for (const row of rows) {
      const name = row.name.trim();
      const phone = row.phone.trim();
      const companyName = normalizeCompanyName(row.company_name);
      if (!name || !companyName) { skipped += 1; continue; }
      const incomingPhone = phoneKey(phone);
      const existing = drivers.find((driver) => (incomingPhone && phoneKey(driver.phone) === incomingPhone)
        || (normalizedName(driver.name) === normalizedName(name) && (!driver.company_name || normalizeCompanyName(driver.company_name) === companyName)));
      if (!existing) {
        const { error: insertError } = await insertDispatchDriver(supabase, { id: createDispatchId(), name, phone, company_name: companyName, assigned_vehicle_id: null, auth_user_id: null, active: true, memo: "" });
        if (insertError) { setError("기사 " + name + " 등록 실패: " + insertError.message); failed = true; break; }
        inserted += 1;
        continue;
      }
      if (existing.company_name && normalizeCompanyName(existing.company_name) !== companyName) { conflicts += 1; continue; }
      if (existing.phone && phone && phoneKey(existing.phone) !== incomingPhone && normalizedName(existing.name) === normalizedName(name)) { conflicts += 1; continue; }
      const payload: Record<string, string> = {};
      if (!existing.company_name && companyName) payload.company_name = companyName;
      if (!existing.phone && phone) payload.phone = phone;
      if (!Object.keys(payload).length) { skipped += 1; continue; }
      const { error: updateError } = await updateDispatchDriver(supabase, existing.id, payload);
      if (updateError) { setError("기사 " + name + " 보완 실패: " + updateError.message); failed = true; break; }
      updated += 1;
    }
    setSaving(false);
    await loadDispatchData();
    if (!failed) onNotify("기사 가져오기 완료 · 신규 " + inserted + "건 · 보완 " + updated + "건");
    return { inserted, updated, skipped, conflicts };
  };

  const saveCustomer = async (customer: DispatchCustomer) => {
    const name = customer.name.trim();
    const duplicate = customers.some((item) => item.id !== customer.id && normalizedMasterName(item.name) === normalizedMasterName(name));
    if (duplicate) { setError("이미 등록된 배차 거래처입니다."); return false; }
    setSaving(true);
    const { error: saveError } = await upsertDispatchCustomer(supabase, { id: customer.id || createDispatchId(), name, active: customer.active, memo: customer.memo.trim() });
    setSaving(false);
    if (saveError) { setError(saveError.code === "23505" ? "이미 등록된 배차 거래처입니다." : `거래처 저장 실패: ${saveError.message}`); return false; }
    await loadDispatchData();
    onNotify(customer.id ? "배차 거래처를 수정했습니다." : "배차 거래처를 등록했습니다.");
    return true;
  };

  const saveLocation = async (location: DispatchLocation) => {
    const name = location.name.trim();
    const duplicate = locations.some((item) => item.id !== location.id && normalizedMasterName(item.name) === normalizedMasterName(name));
    if (duplicate) { setError("이미 등록된 배차 장소입니다."); return false; }
    setSaving(true);
    const { error: saveError } = await upsertDispatchLocation(supabase, { id: location.id || createDispatchId(), name, location_type: location.location_type, active: location.active, memo: location.memo.trim() });
    setSaving(false);
    if (saveError) { setError(saveError.code === "23505" ? "이미 등록된 배차 장소입니다." : `장소 저장 실패: ${saveError.message}`); return false; }
    await loadDispatchData();
    onNotify(location.id ? "배차 장소를 수정했습니다." : "배차 장소를 등록했습니다.");
    return true;
  };

  const saveItem = async (item: DispatchItem) => {
    const name = item.name.trim().replace(/\s+/g, " ");
    const duplicate = items.some((existing) => existing.id !== item.id && normalizedMasterName(existing.name) === normalizedMasterName(name));
    if (duplicate) { setError("이미 등록된 배차 품목입니다."); return false; }
    setSaving(true);
    const { error: saveError } = await upsertDispatchItem(supabase, { id: item.id || createDispatchId(), name, active: item.active, memo: item.memo.trim() });
    setSaving(false);
    if (saveError) { setError(saveError.code === "23505" ? "이미 등록된 배차 품목입니다." : `품목 저장 실패: ${saveError.message}`); return false; }
    await loadDispatchData();
    onNotify(item.id ? "배차 품목을 수정했습니다." : "배차 품목을 등록했습니다.");
    return true;
  };

  const saveOrder = async (form: DispatchOrderForm) => {
    const vendorName = form.vendor_name.trim();
    const itemName = form.item_name.trim().replace(/\s+/g, " ");
    if (!vendorName || !itemName) {
      setError("입력한 거래처 또는 품목을 확인해 주세요.");
      return false;
    }

    let selectedCustomer = customers.find((customer) => customer.id === form.vendor_id)
      || customers.find((customer) => normalizedMasterName(customer.name) === normalizedMasterName(vendorName));
    let selectedItem = items.find((item) => item.id === form.item_id)
      || items.find((item) => normalizedMasterName(item.name) === normalizedMasterName(itemName));

    setSaving(true);
    if (!selectedCustomer && form.save_vendor) {
      const customer: DispatchCustomer = { id: createDispatchId(), name: vendorName, active: true, memo: "" };
      const { error: customerError } = await insertDispatchCustomer(supabase, customer);
      if (customerError) {
        setSaving(false);
        setError(customerError.code === "23505" ? "같은 이름의 배차 거래처가 이미 있습니다. 새로고침 후 선택해 주세요." : `신규 거래처 저장 실패: ${customerError.message}`);
        return false;
      }
      selectedCustomer = customer;
    }

    if (!selectedItem && form.save_item) {
      const item: DispatchItem = { id: createDispatchId(), name: itemName, active: true, memo: "" };
      const { error: itemError } = await insertDispatchItem(supabase, item);
      if (itemError) {
        setSaving(false);
        setError(itemError.code === "23505" ? "같은 이름의 배차 품목이 이미 있습니다. 새로고침 후 선택해 주세요." : `신규 품목 저장 실패: ${itemError.message}`);
        return false;
      }
      selectedItem = item;
    }

    const pendingLocations = new Map<string, { id: string; name: string; location_type: DispatchLocationType; active: boolean; memo: string }>();
    const addPendingLocation = (nameValue: string, type: Exclude<DispatchLocationType, "공용">, shouldSave: boolean) => {
      const name = nameValue.trim();
      if (!shouldSave || locations.some((location) => normalizedMasterName(location.name) === normalizedMasterName(name))) return;
      const key = normalizedMasterName(name);
      const previous = pendingLocations.get(key);
      pendingLocations.set(key, { id: previous?.id || createDispatchId(), name, location_type: previous && previous.location_type !== type ? "공용" : type, active: true, memo: "" });
    };
    addPendingLocation(form.loading_location, "상차지", form.save_loading_location);
    addPendingLocation(form.unloading_location, "하차지", form.save_unloading_location);
    if (pendingLocations.size) {
      const { error: locationError } = await insertDispatchLocations(supabase, [...pendingLocations.values()]);
      if (locationError) {
        setSaving(false);
        setError(locationError.code === "23505" ? "같은 이름의 배차 장소가 이미 있습니다. 새로고침 후 선택해 주세요." : `신규 장소 저장 실패: ${locationError.message}`);
        return false;
      }
    }

    const totalVolume = toPositiveNumber(form.total_volume);
    const volumePerTrip = toPositiveNumber(form.volume_per_trip);
    const orderId = form.id || createDispatchId();
    const orderPayload: DispatchOrder = {
      id: orderId,
      dispatch_date: form.dispatch_date,
      vendor_id: selectedCustomer?.id || null,
      vendor_name: vendorName,
      loading_location: form.loading_location.trim(),
      unloading_location: form.unloading_location.trim(),
      item_id: selectedItem?.id || null,
      item_name: itemName,
      total_volume: totalVolume,
      volume_per_trip: volumePerTrip,
      estimated_trip_count: calculateEstimatedTrips(totalVolume, volumePerTrip),
      status: form.status,
      memo: form.memo.trim(),
    };

    const { error: saveError } = await saveDispatchOrderWithAssignments(supabase, orderPayload, form.assignments);
    setSaving(false);
    if (saveError) {
      setError(`배차 저장 실패: ${saveError.message}`);
      return false;
    }

    setEditingOrder(null);
    await loadDispatchData();
    onNotify(form.id ? "배차를 수정했습니다." : "배차를 등록했습니다.");
    if (allowedViews.includes("dispatch_list")) onNavigate("dispatch_list");
    return true;
  };

  const deleteOrder = async (order: DispatchOrderWithVehicles) => {
    setDeletingOrderId(order.id);
    setError("");
    const { error: deleteError } = await deleteDispatchOrder(supabase, order.id);
    setDeletingOrderId("");
    if (deleteError) {
      setError(`배차 휴지통 이동 실패: ${deleteError.message}`);
      return false;
    }
    if (editingOrder?.id === order.id) setEditingOrder(null);
    await loadDispatchData();
    onNotify("배차를 휴지통으로 이동했습니다. 운행기록은 보존됩니다.");
    return true;
  };

  const restoreOrder = async (order: DispatchOrderWithVehicles) => {
    setDeletingOrderId(order.id);
    setError("");
    const { error: restoreError } = await restoreDispatchOrder(supabase, order.id);
    setDeletingOrderId("");
    if (restoreError) {
      setError(`배차 복구 실패: ${restoreError.message}`);
      return false;
    }
    await loadDispatchData();
    onNotify("배차를 복구했습니다.");
    return true;
  };

  const permanentlyDeleteOrder = async (order: DispatchOrderWithVehicles) => {
    setDeletingOrderId(order.id);
    setError("");
    const { error: permanentError } = await permanentlyDeleteDispatchOrder(supabase, order.id);
    setDeletingOrderId("");
    if (permanentError) {
      setError(`배차 영구삭제 실패: ${permanentError.message}`);
      return false;
    }
    await loadDispatchData();
    onNotify("배차와 연결된 운행기록을 영구삭제했습니다.");
    return true;
  };

  const editOrder = (order: DispatchOrderWithVehicles) => {
    setEditingOrder(order);
    onNavigate("dispatch_register");
  };

  const summary = useMemo(() => summarizeDispatchOverview(orders, trips, dispatchToday()), [orders, trips]);

  if (!allowedViews.includes(view)) return <section className="dispatch-panel"><p className="dispatch-error">이 운행관리 메뉴의 사용 권한이 없습니다.</p></section>;

  return (
    <div className="dispatch-page">
      <div className="dispatch-command-bar">
        <header className="dispatch-hero">
          <div><span>DISPATCH CONTROL</span><h1>운행관리</h1><p>차량·기사·배차 현황을 관리합니다.</p></div>
          <button type="button" onClick={() => void loadDispatchData()} disabled={initialLoading || refreshing}>{refreshing ? "새로고침 중..." : "새로고침"}</button>
        </header>
        <div className="dispatch-summary" aria-label="배차 현황 요약">
          <article className="dispatch-kpi-card today">
            <div className="dispatch-kpi-icon"><CalendarDays aria-hidden="true" /></div>
            <div className="dispatch-kpi-body">
              <span className="dispatch-kpi-label">오늘 배차</span>
              <div className="dispatch-kpi-value"><strong>{canReadOrders ? summary.today.toLocaleString("ko-KR") : "—"}</strong>{canReadOrders && <small>건</small>}</div>
              <span className="dispatch-kpi-caption">{canReadOrders ? "오늘 배차일 기준" : "조회 권한 없음"}</span>
            </div>
          </article>
          <article className="dispatch-kpi-card active">
            <div className="dispatch-kpi-icon"><CirclePlay aria-hidden="true" /></div>
            <div className="dispatch-kpi-body">
              <span className="dispatch-kpi-label">진행중</span>
              <div className="dispatch-kpi-value"><strong>{canReadOrders ? summary.active.toLocaleString("ko-KR") : "—"}</strong>{canReadOrders && <small>건</small>}</div>
              <span className="dispatch-kpi-caption">{canReadOrders ? "전체 배차 기준" : "조회 권한 없음"}</span>
            </div>
          </article>
          <article className="dispatch-kpi-card done">
            <div className="dispatch-kpi-icon"><CircleCheckBig aria-hidden="true" /></div>
            <div className="dispatch-kpi-body">
              <span className="dispatch-kpi-label">완료</span>
              <div className="dispatch-kpi-value"><strong>{canReadOrders ? summary.done.toLocaleString("ko-KR") : "—"}</strong>{canReadOrders && <small>건</small>}</div>
              <span className="dispatch-kpi-caption">{canReadOrders ? "전체 배차 기준" : "조회 권한 없음"}</span>
            </div>
          </article>
          <article className="dispatch-kpi-card volume">
            <div className="dispatch-kpi-icon"><Boxes aria-hidden="true" /></div>
            <div className="dispatch-kpi-body">
              <span className="dispatch-kpi-label">실제 운송량</span>
              <div className="dispatch-kpi-value"><strong>{canReadTrips ? summary.actualVolumeToday.toLocaleString("ko-KR") : "—"}</strong>{canReadTrips && <small>루베</small>}</div>
              {canReadTrips ? (
                <div className={`dispatch-kpi-delta ${summary.actualVolumeDiff > 0 ? "up" : summary.actualVolumeDiff < 0 ? "down" : "same"}`} title={`전일 실제 운송량 ${summary.actualVolumeYesterday.toLocaleString("ko-KR")}루베 · 한국시간 하차 완료일 기준`}>
                  {summary.actualVolumeDiff > 0 ? <ArrowUp aria-hidden="true" /> : summary.actualVolumeDiff < 0 ? <ArrowDown aria-hidden="true" /> : null}
                  <span>전일 대비 {summary.actualVolumeDiff > 0 ? "+" : ""}{summary.actualVolumeDiff.toLocaleString("ko-KR")}루베</span>
                </div>
              ) : <span className="dispatch-kpi-caption">조회 권한 없음</span>}
            </div>
          </article>
        </div>
      </div>
      <nav className="dispatch-tabs">{(Object.keys(viewLabels) as DispatchView[]).filter((key) => allowedViews.includes(key)).map((key) => <button type="button" key={key} className={view === key ? "active" : ""} aria-current={view === key ? "page" : undefined} onClick={() => onNavigate(key)}>{viewLabels[key]}</button>)}</nav>
      {error && <div className="dispatch-load-error">{error}</div>}
      {initialLoading ? <div className="dispatch-loading">배차관리 자료를 불러오는 중...</div> : <>
        {view === "dispatch_register" && <><DispatchRegister customers={customers} locations={locations} items={items} vehicles={vehicles} drivers={drivers} editingOrder={editingOrder} saving={saving} onSave={saveOrder} onCancelEdit={() => setEditingOrder(null)} /><DispatchList orders={orders} vehicles={vehicles} drivers={drivers} trips={trips} tripLocations={tripLocations} onEdit={editOrder} compact /></>}
        {view === "dispatch_list" && <DispatchList orders={orders} deletedOrders={deletedOrders} vehicles={vehicles} drivers={drivers} trips={trips} tripLocations={tripLocations} onEdit={editOrder} onDelete={deleteOrder} onRestore={restoreOrder} onPermanentDelete={permanentlyDeleteOrder} deletingOrderId={deletingOrderId} />}
        {view === "dispatch_results" && <TransportResults supabase={supabase} vehicles={vehicles} drivers={drivers} />}
        {view === "dispatch_status" && <DriverStatusDashboard drivers={drivers} vehicles={vehicles} />}
        {view === "dispatch_vehicles" && <VehicleManagement vehicles={vehicles} saving={saving} onSave={saveVehicle} onImport={importVehicles} />}
        {view === "dispatch_drivers" && <DriverManagement drivers={drivers} saving={saving} canManageAuthUserId={isAdmin} onSave={saveDriver} onImport={importDrivers} />}
        {view === "dispatch_basics" && <DispatchBasics customers={customers} locations={locations} items={items} saving={saving} onSaveCustomer={saveCustomer} onSaveLocation={saveLocation} onSaveItem={saveItem} />}
      </>}
    </div>
  );
}
