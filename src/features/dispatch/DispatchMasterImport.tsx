import { useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import type { DispatchDriver, DispatchVehicle } from "./dispatchTypes";
import { normalizeCompanyName, normalizeVehicleNumber } from "./dispatchUtils";

export type VehicleImportRow = {
  company_name: string;
  vehicle_number: string;
};

export type DriverImportRow = {
  company_name: string;
  name: string;
  phone: string;
};

export type DispatchMasterImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  conflicts: number;
};

type PreviewRow = {
  rowNo: number;
  company_name: string;
  primary: string;
  secondary: string;
  status: "신규" | "기존 보완" | "기존 유지" | "확인 필요";
  message: string;
  canImport: boolean;
};

type DispatchMasterImportProps = {
  kind: "vehicle" | "driver";
  vehicles?: DispatchVehicle[];
  drivers?: DispatchDriver[];
  saving?: boolean;
  onImport: (rows: VehicleImportRow[] | DriverImportRow[]) => Promise<DispatchMasterImportResult>;
};

const textValue = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
const phoneValue = (value: unknown) => textValue(value).replace(/[^0-9+]/g, "");
const phoneKey = (value: string) => value.replace(/[^0-9]/g, "");
const normalizedName = (value: string) => textValue(value).toLocaleLowerCase("ko-KR");

const findHeader = (headers: string[], names: string[]) => {
  const normalizedHeaders = headers.map((header) => normalizedName(header).replace(/\s/g, ""));
  const target = names.map((name) => normalizedName(name).replace(/\s/g, ""));
  const index = normalizedHeaders.findIndex((header) => target.includes(header));
  return index >= 0 ? headers[index] : "";
};

const cell = (row: Record<string, unknown>, header: string) => header ? row[header] : "";

// 개인 차량의 소속에는 기사 이름이 함께 적혀 있는 경우가 있어, 기사 목록과
// 업체를 맞출 때만 이름 부분을 제거합니다. 원본 파일 값 자체는 수정하지 않습니다.
const normalizeVehicleCompany = (value: string) => {
  const company = normalizeCompanyName(value);
  return company.replace(/\s+[^\s()]+(?=\(개인\)$)/, "");
};

const readSheetRows = async (file: File, kind: "vehicle" | "driver") => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const candidates: Array<{ rows: Record<string, unknown>[]; headers: string[] }> = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "", raw: false });
    if (rows.length) candidates.push({ rows, headers: Object.keys(rows[0]) });
  }
  const matching = candidates.find(({ headers }) => Boolean(findHeader(headers, kind === "vehicle" ? ["차량번호", "차량 번호", "차번호"] : ["기사명", "기사", "성명", "이름"])));
  return matching?.rows || candidates[0]?.rows || [];
};

export default function DispatchMasterImport({ kind, vehicles = [], drivers = [], saving = false, onImport }: DispatchMasterImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [parsedRows, setParsedRows] = useState<VehicleImportRow[] | DriverImportRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const parseFile = async (file: File) => {
    setError("");
    setMessage("");
    try {
      const rows = await readSheetRows(file, kind);
      if (!rows.length) throw new Error("엑셀에서 읽을 수 있는 행이 없습니다.");
      const headers = Object.keys(rows[0]);
      const companyHeader = findHeader(headers, ["소속", "업체", "회사", "회사명"]);
      if (!companyHeader) throw new Error("소속/업체 열을 찾지 못했습니다.");

      if (kind === "vehicle") {
        const vehicleHeader = findHeader(headers, ["차량번호", "차량 번호", "차번호"]);
        if (!vehicleHeader) throw new Error("차량번호 열을 찾지 못했습니다.");
        const deduped = new Map<string, VehicleImportRow>();
        rows.forEach((row) => {
          const vehicleNumber = normalizeVehicleNumber(textValue(cell(row, vehicleHeader)));
          if (!vehicleNumber) return;
          const companyName = normalizeVehicleCompany(textValue(cell(row, companyHeader)));
          deduped.set(vehicleNumber.toLocaleLowerCase("ko-KR"), { company_name: companyName, vehicle_number: vehicleNumber });
        });
        const parsed = [...deduped.values()];
        setParsedRows(parsed);
        setPreview(parsed.map((row, index) => {
          const existing = vehicles.find((vehicle) => normalizeVehicleNumber(vehicle.vehicle_number).toLocaleLowerCase("ko-KR") === row.vehicle_number.toLocaleLowerCase("ko-KR"));
          if (!existing) return { rowNo: index + 2, company_name: row.company_name || "-", primary: row.vehicle_number, secondary: "차량", status: "신규", message: "새 차량으로 등록", canImport: true };
          const existingCompany = normalizeCompanyName(existing.company_name);
          const incomingCompany = normalizeCompanyName(row.company_name);
          if (existingCompany && incomingCompany && existingCompany !== incomingCompany) return { rowNo: index + 2, company_name: row.company_name || "-", primary: row.vehicle_number, secondary: "차량", status: "확인 필요", message: `기존 업체: ${existingCompany}`, canImport: false };
          if (!existingCompany && incomingCompany) return { rowNo: index + 2, company_name: row.company_name || "-", primary: row.vehicle_number, secondary: "차량", status: "기존 보완", message: "기존 차량의 빈 업체만 입력", canImport: true };
          return { rowNo: index + 2, company_name: existingCompany || row.company_name || "-", primary: row.vehicle_number, secondary: "차량", status: "기존 유지", message: "ERP 기존 정보 우선", canImport: true };
        }));
      } else {
        const nameHeader = findHeader(headers, ["기사명", "기사", "성명", "이름"]);
        const phoneHeader = findHeader(headers, ["연락처", "전화번호", "휴대폰", "휴대전화"]);
        if (!nameHeader) throw new Error("기사명/성명 열을 찾지 못했습니다.");
        const deduped = new Map<string, DriverImportRow>();
        rows.forEach((row) => {
          const name = textValue(cell(row, nameHeader));
          if (!name) return;
          const phone = phoneValue(cell(row, phoneHeader));
          const companyName = normalizeCompanyName(textValue(cell(row, companyHeader)));
          const key = phoneKey(phone) || `${normalizedName(companyName)}|${normalizedName(name)}`;
          deduped.set(key, { company_name: companyName, name, phone });
        });
        const parsed = [...deduped.values()];
        setParsedRows(parsed);
        setPreview(parsed.map((row, index) => {
          const incomingPhone = phoneKey(row.phone);
          const incomingCompany = normalizeCompanyName(row.company_name);
          const existing = drivers.find((driver) => (incomingPhone && phoneKey(driver.phone) === incomingPhone)
            || (normalizedName(driver.name) === normalizedName(row.name) && (!incomingCompany || !driver.company_name || normalizeCompanyName(driver.company_name) === incomingCompany)));
          if (!existing) return { rowNo: index + 2, company_name: row.company_name || "-", primary: row.name, secondary: row.phone || "연락처 없음", status: "신규", message: "새 기사로 등록", canImport: true };
          const existingCompany = normalizeCompanyName(existing.company_name);
          const existingPhone = phoneKey(existing.phone);
          if (existingCompany && incomingCompany && existingCompany !== incomingCompany) return { rowNo: index + 2, company_name: row.company_name || "-", primary: row.name, secondary: row.phone || "연락처 없음", status: "확인 필요", message: `기존 업체: ${existingCompany}`, canImport: false };
          if (existingPhone && incomingPhone && existingPhone !== incomingPhone && normalizedName(existing.name) === normalizedName(row.name)) return { rowNo: index + 2, company_name: existingCompany || row.company_name || "-", primary: row.name, secondary: row.phone || "연락처 확인", status: "확인 필요", message: "같은 이름의 연락처가 다름", canImport: false };
          const supplements = [!existingCompany && incomingCompany ? "업체" : "", !existingPhone && incomingPhone ? "연락처" : ""].filter(Boolean);
          return { rowNo: index + 2, company_name: existingCompany || row.company_name || "-", primary: row.name, secondary: row.phone || "연락처 없음", status: supplements.length ? "기존 보완" : "기존 유지", message: supplements.length ? `${supplements.join("·")} 빈 값만 입력` : "ERP 기존 정보 우선", canImport: true };
        }));
      }
      setFileName(file.name);
    } catch (parseError) {
      setParsedRows([]);
      setPreview([]);
      setFileName("");
      setError(parseError instanceof Error ? parseError.message : "엑셀을 읽지 못했습니다.");
    }
  };

  const startImport = async () => {
    const importable = preview.reduce<(VehicleImportRow | DriverImportRow)[]>((result, item, index) => {
      if (item.canImport && parsedRows[index]) result.push(parsedRows[index]);
      return result;
    }, []);
    if (!importable.length) return setError("가져올 수 있는 행이 없습니다. 확인 필요 항목을 먼저 검토하세요.");
    const result = await onImport(kind === "vehicle" ? importable as VehicleImportRow[] : importable as DriverImportRow[]);
    setMessage(`신규 ${result.inserted}건 · 보완 ${result.updated}건${result.conflicts ? ` · 확인 필요 ${result.conflicts}건` : ""}${result.skipped ? ` · 건너뜀 ${result.skipped}건` : ""}`);
  };

  return <div className="dispatch-master-import">
    <button type="button" className="dispatch-outline-button" onClick={() => inputRef.current?.click()} disabled={saving}>엑셀 업로드</button>
    <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseFile(file); event.currentTarget.value = ""; }} />
    {fileName && <div className="dispatch-import-preview">
      <div className="dispatch-import-head"><div><strong>{fileName}</strong><span>{preview.length}건 미리보기 · ERP 기존 정보 우선</span></div><button type="button" className="dispatch-primary" onClick={() => void startImport()} disabled={saving}>선택 항목 반영</button></div>
      <div className="dispatch-import-table-wrap"><table className="dispatch-table dispatch-import-table"><thead><tr><th>행</th><th>업체</th><th>{kind === "vehicle" ? "차량번호" : "기사명"}</th><th>{kind === "vehicle" ? "구분" : "연락처"}</th><th>상태</th><th>처리 기준</th></tr></thead><tbody>{preview.map((row) => <tr key={`${row.rowNo}-${row.primary}`}><td>{row.rowNo}</td><td>{row.company_name}</td><td className="dispatch-strong">{row.primary}</td><td>{row.secondary}</td><td><span className={`dispatch-import-status ${row.status === "확인 필요" ? "conflict" : row.status === "신규" ? "new" : ""}`}>{row.status}</span></td><td>{row.message}</td></tr>)}</tbody></table></div>
    </div>}
    {message && <p className="dispatch-import-message">{message}</p>}
    {error && <p className="dispatch-error">{error}</p>}
  </div>;
}
