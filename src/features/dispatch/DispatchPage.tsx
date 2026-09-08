import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import DispatchList from "./DispatchList";
import DispatchRegister from "./DispatchRegister";
import DispatchBasics from "./DispatchBasics";
import DriverManagement from "./DriverManagement";
import VehicleManagement from "./VehicleManagement";
import type { DispatchCustomer, DispatchDriver, DispatchLocation, DispatchLocationType, DispatchOrder, DispatchOrderForm, DispatchOrderVehicle, DispatchOrderWithVehicles, DispatchReferenceOption, DispatchVehicle, DispatchView } from "./dispatchTypes";
import { createDispatchId, dispatchToday, toPositiveNumber, calculateEstimatedTrips } from "./dispatchUtils";
import "./dispatch.css";

type DispatchPageProps = {
  view: DispatchView;
  supabase: SupabaseClient;
  items: DispatchReferenceOption[];
  isAdmin: boolean;
  onNavigate: (view: DispatchView) => void;
  onNotify: (message: string) => void;
};

const viewLabels: Record<DispatchView, string> = {
  dispatch_register: "배차등록",
  dispatch_list: "배차목록",
  dispatch_vehicles: "차량관리",
  dispatch_drivers: "기사관리",
  dispatch_basics: "배차 기초관리",
};

const normalizedMasterName = (value: string) => value.trim().toLocaleLowerCase("ko-KR");

export default function DispatchPage({ view, supabase, items, isAdmin, onNavigate, onNotify }: DispatchPageProps) {
  const [vehicles, setVehicles] = useState<DispatchVehicle[]>([]);
  const [drivers, setDrivers] = useState<DispatchDriver[]>([]);
  const [customers, setCustomers] = useState<DispatchCustomer[]>([]);
  const [locations, setLocations] = useState<DispatchLocation[]>([]);
  const [orders, setOrders] = useState<DispatchOrderWithVehicles[]>([]);
  const [editingOrder, setEditingOrder] = useState<DispatchOrderWithVehicles | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadDispatchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const [vehicleResult, driverResult, orderResult, assignmentResult, customerResult, locationResult] = await Promise.all([
      supabase.from("dispatch_vehicles").select("*").order("vehicle_number", { ascending: true }),
      supabase.from("dispatch_drivers").select("*").order("name", { ascending: true }),
      supabase.from("dispatch_orders").select("*").order("dispatch_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("dispatch_order_vehicles").select("*").order("created_at", { ascending: true }),
      supabase.from("dispatch_customers").select("*").order("name", { ascending: true }),
      supabase.from("dispatch_locations").select("*").order("name", { ascending: true }),
    ]);

    const firstError = vehicleResult.error || driverResult.error || orderResult.error || assignmentResult.error || customerResult.error || locationResult.error;
    if (firstError) {
      setError(`배차관리 자료를 불러오지 못했습니다. 신규 테이블 SQL 적용 여부를 확인하세요. (${firstError.message})`);
      setLoading(false);
      return;
    }

    const nextVehicles = (vehicleResult.data || []).map((row) => ({ ...row, id: String(row.id), vehicle_number: String(row.vehicle_number || ""), active: row.active !== false, memo: String(row.memo || "") })) as DispatchVehicle[];
    const nextDrivers = (driverResult.data || []).map((row) => ({ ...row, id: String(row.id), name: String(row.name || ""), phone: String(row.phone || ""), assigned_vehicle_id: row.assigned_vehicle_id ? String(row.assigned_vehicle_id) : null, active: row.active !== false, memo: String(row.memo || "") })) as DispatchDriver[];
    const nextCustomers = (customerResult.data || []).map((row) => ({ ...row, id: String(row.id), name: String(row.name || ""), active: row.active !== false, memo: String(row.memo || "") })) as DispatchCustomer[];
    const nextLocations = (locationResult.data || []).map((row) => ({ ...row, id: String(row.id), name: String(row.name || ""), location_type: String(row.location_type || "공용") as DispatchLocationType, active: row.active !== false, memo: String(row.memo || "") })) as DispatchLocation[];
    const assignments = (assignmentResult.data || []).map((row) => ({ ...row, id: String(row.id), order_id: String(row.order_id), vehicle_id: String(row.vehicle_id) })) as DispatchOrderVehicle[];
    const assignmentMap = new Map<string, string[]>();
    assignments.forEach((assignment) => assignmentMap.set(assignment.order_id, [...(assignmentMap.get(assignment.order_id) || []), assignment.vehicle_id]));
    const nextOrders = (orderResult.data || []).map((row) => ({
      ...row,
      id: String(row.id),
      dispatch_date: String(row.dispatch_date || ""),
      vendor_id: row.vendor_id ? String(row.vendor_id) : null,
      vendor_name: String(row.vendor_name || ""),
      loading_location: String(row.loading_location || ""),
      unloading_location: String(row.unloading_location || ""),
      item_id: row.item_id ? String(row.item_id) : null,
      item_name: String(row.item_name || ""),
      total_volume: Number(row.total_volume || 0),
      volume_per_trip: Number(row.volume_per_trip || 0),
      estimated_trip_count: Number(row.estimated_trip_count || 0),
      status: row.status,
      memo: String(row.memo || ""),
      vehicle_ids: assignmentMap.get(String(row.id)) || [],
    })) as DispatchOrderWithVehicles[];

    setVehicles(nextVehicles);
    setDrivers(nextDrivers);
    setCustomers(nextCustomers);
    setLocations(nextLocations);
    setOrders(nextOrders);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadDispatchData(); }, [loadDispatchData]);

  const saveVehicle = async (vehicle: DispatchVehicle) => {
    setSaving(true);
    const payload = { id: vehicle.id || createDispatchId(), vehicle_number: vehicle.vehicle_number, active: vehicle.active, memo: vehicle.memo };
    const { error: saveError } = await supabase.from("dispatch_vehicles").upsert(payload);
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
    const payload = { id: driver.id || createDispatchId(), name: driver.name, phone: driver.phone, assigned_vehicle_id: driver.assigned_vehicle_id, active: driver.active, memo: driver.memo };
    const { error: saveError } = await supabase.from("dispatch_drivers").upsert(payload);
    setSaving(false);
    if (saveError) {
      setError(`기사 저장 실패: ${saveError.message}`);
      return false;
    }
    await loadDispatchData();
    onNotify(driver.id ? "기사정보를 수정했습니다." : "기사를 등록했습니다.");
    return true;
  };

  const saveCustomer = async (customer: DispatchCustomer) => {
    const name = customer.name.trim();
    const duplicate = customers.some((item) => item.id !== customer.id && normalizedMasterName(item.name) === normalizedMasterName(name));
    if (duplicate) { setError("이미 등록된 배차 거래처입니다."); return false; }
    setSaving(true);
    const { error: saveError } = await supabase.from("dispatch_customers").upsert({ id: customer.id || createDispatchId(), name, active: customer.active, memo: customer.memo.trim() });
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
    const { error: saveError } = await supabase.from("dispatch_locations").upsert({ id: location.id || createDispatchId(), name, location_type: location.location_type, active: location.active, memo: location.memo.trim() });
    setSaving(false);
    if (saveError) { setError(saveError.code === "23505" ? "이미 등록된 배차 장소입니다." : `장소 저장 실패: ${saveError.message}`); return false; }
    await loadDispatchData();
    onNotify(location.id ? "배차 장소를 수정했습니다." : "배차 장소를 등록했습니다.");
    return true;
  };

  const saveOrder = async (form: DispatchOrderForm) => {
    const item = items.find((option) => option.id === form.item_id);
    const vendorName = form.vendor_name.trim();
    if (!vendorName || !item) {
      setError("입력한 거래처 또는 선택한 품목을 확인해 주세요.");
      return false;
    }

    let selectedCustomer = customers.find((customer) => customer.id === form.vendor_id)
      || customers.find((customer) => normalizedMasterName(customer.name) === normalizedMasterName(vendorName));

    setSaving(true);
    if (!selectedCustomer && form.save_vendor) {
      const customer: DispatchCustomer = { id: createDispatchId(), name: vendorName, active: true, memo: "" };
      const { error: customerError } = await supabase.from("dispatch_customers").insert(customer);
      if (customerError) {
        setSaving(false);
        setError(customerError.code === "23505" ? "같은 이름의 배차 거래처가 이미 있습니다. 새로고침 후 선택해 주세요." : `신규 거래처 저장 실패: ${customerError.message}`);
        return false;
      }
      selectedCustomer = customer;
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
      const { error: locationError } = await supabase.from("dispatch_locations").insert([...pendingLocations.values()]);
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
      item_id: item.id,
      item_name: item.name,
      total_volume: totalVolume,
      volume_per_trip: volumePerTrip,
      estimated_trip_count: calculateEstimatedTrips(totalVolume, volumePerTrip),
      status: form.status,
      memo: form.memo.trim(),
    };

    const { error: saveError } = await supabase.rpc("save_dispatch_order", { p_order: orderPayload, p_vehicle_ids: form.vehicle_ids });
    setSaving(false);
    if (saveError) {
      setError(`배차 저장 실패: ${saveError.message}`);
      return false;
    }

    setEditingOrder(null);
    await loadDispatchData();
    onNotify(form.id ? "배차를 수정했습니다." : "배차를 등록했습니다.");
    onNavigate("dispatch_list");
    return true;
  };

  const editOrder = (order: DispatchOrderWithVehicles) => {
    setEditingOrder(order);
    onNavigate("dispatch_register");
  };

  const summary = useMemo(() => {
    const todayOrders = orders.filter((order) => order.dispatch_date === dispatchToday());
    return {
      today: todayOrders.length,
      waiting: orders.filter((order) => order.status === "대기").length,
      active: orders.filter((order) => order.status === "진행중").length,
      done: orders.filter((order) => order.status === "완료").length,
    };
  }, [orders]);

  if (!isAdmin) return <section className="dispatch-panel"><p className="dispatch-error">배차관리는 관리자만 사용할 수 있습니다.</p></section>;

  return (
    <div className="dispatch-page">
      <header className="dispatch-hero">
        <div><span>25.5T DUMP DISPATCH</span><h1>운행관리</h1><p>차량·기사·배차를 한 화면 흐름으로 관리합니다.</p></div>
        <button type="button" onClick={() => void loadDispatchData()} disabled={loading}>새로고침</button>
      </header>
      <div className="dispatch-summary">
        <div><span>오늘 배차</span><b>{summary.today}건</b></div><div><span>대기</span><b>{summary.waiting}건</b></div><div><span>진행중</span><b>{summary.active}건</b></div><div><span>완료</span><b>{summary.done}건</b></div>
      </div>
      <nav className="dispatch-tabs">{(Object.keys(viewLabels) as DispatchView[]).map((key) => <button type="button" key={key} className={view === key ? "active" : ""} onClick={() => onNavigate(key)}>{viewLabels[key]}</button>)}</nav>
      {error && <div className="dispatch-load-error">{error}</div>}
      {loading ? <div className="dispatch-loading">배차관리 자료를 불러오는 중...</div> : <>
        {view === "dispatch_register" && <><DispatchRegister customers={customers} locations={locations} items={items} vehicles={vehicles} editingOrder={editingOrder} saving={saving} onSave={saveOrder} onCancelEdit={() => setEditingOrder(null)} /><DispatchList orders={orders} vehicles={vehicles} onEdit={editOrder} compact /></>}
        {view === "dispatch_list" && <DispatchList orders={orders} vehicles={vehicles} onEdit={editOrder} />}
        {view === "dispatch_vehicles" && <VehicleManagement vehicles={vehicles} saving={saving} onSave={saveVehicle} />}
        {view === "dispatch_drivers" && <DriverManagement drivers={drivers} vehicles={vehicles} saving={saving} onSave={saveDriver} />}
        {view === "dispatch_basics" && <DispatchBasics customers={customers} locations={locations} saving={saving} onSaveCustomer={saveCustomer} onSaveLocation={saveLocation} />}
      </>}
    </div>
  );
}
