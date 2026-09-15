from pathlib import Path

p = Path('src/features/fuel/FuelManagement.tsx')
s = p.read_text()

replacements = [
    (
        'return candidateText.includes("차량번호") && candidateText.includes("합계금액") && candidateText.includes("현장명");',
        'return candidateText.includes("차량번호") && candidateText.includes("합계금액") && (candidateText.includes("현장명") || candidateText.includes("제품명"));',
    ),
    (
        'return normalized.includes("현장명") && normalized.includes("차량번호") && normalized.includes("일자");',
        'return normalized.includes("차량번호") && normalized.includes("일자") && normalized.some((header) => header.includes("제품명"));',
    ),
    (
        'if (headerIndex < 0) throw new Error("현장명·차량번호·일자 헤더를 찾지 못했습니다.");',
        'if (headerIndex < 0) throw new Error("제품명·차량번호·일자 헤더를 찾지 못했습니다.");',
    ),
    (
        'if ([columns.site, columns.product, columns.vehicle, columns.date, columns.quantity, columns.total].some((value) => value < 0)) {',
        'if ([columns.product, columns.vehicle, columns.date, columns.quantity, columns.total].some((value) => value < 0)) {',
    ),
    (
        '  let lastSite = "";\n  let lastProduct = "";',
        '  const hasSiteColumn = columns.site >= 0;\n  let lastSite = hasSiteColumn ? "" : "미지정";\n  let lastProduct = "";',
    ),
    (
        '      memo: "",\n    });',
        '      memo: hasSiteColumn ? "" : "원본 명세서에 현장명 없음",\n    });',
    ),
    (
        'const normalizeHeader = (value: unknown) => text(value).replace(/\\s/g, "").replace(/[()（）]/g, "").toLowerCase();\n',
        'const normalizeHeader = (value: unknown) => text(value).replace(/\\s/g, "").replace(/[()（）]/g, "").toLowerCase();\nconst FACTORY_VEHICLE_SUFFIXES = new Set(["1166", "1184", "1237", "4761", "5907", "6086", "9366"]);\nconst ASSEMBLY_VEHICLE_SUFFIXES = new Set(["4676", "6148", "7151", "7844", "8288", "8408"]);\nconst inferFuelSite = (vehicle: string) => {\n  const digits = String(vehicle || "").replace(/\\D/g, "");\n  const suffix = digits.slice(-4);\n  if (FACTORY_VEHICLE_SUFFIXES.has(suffix)) return "공장";\n  if (ASSEMBLY_VEHICLE_SUFFIXES.has(suffix)) return "국회";\n  return "";\n};\n',
    ),
    (
        '    const site = text(valueAt(columns.site)) || lastSite;\n    const product = text(valueAt(columns.product)) || lastProduct;\n    const vehicle = text(valueAt(columns.vehicle)) || lastVehicle;\n    if (text(valueAt(columns.site))) lastSite = site;\n    if (text(valueAt(columns.product))) lastProduct = product;\n    if (text(valueAt(columns.vehicle))) lastVehicle = vehicle;\n\n    const fuelDate = parseDate(valueAt(columns.date), year, month);\n    if (!fuelDate || !vehicle) return;\n',
        '    const sourceSite = text(valueAt(columns.site)) || lastSite;\n    const product = text(valueAt(columns.product)) || lastProduct;\n    const vehicle = text(valueAt(columns.vehicle)) || lastVehicle;\n    if (text(valueAt(columns.site))) lastSite = sourceSite;\n    if (text(valueAt(columns.product))) lastProduct = product;\n    if (text(valueAt(columns.vehicle))) lastVehicle = vehicle;\n\n    const fuelDate = parseDate(valueAt(columns.date), year, month);\n    if (!fuelDate || !vehicle) return;\n    const autoSite = hasSiteColumn ? "" : inferFuelSite(vehicle);\n    const site = sourceSite && sourceSite !== "미지정" ? sourceSite : autoSite || sourceSite || "미지정";\n',
    ),
    (
        '    const rawFingerprint = [stationName, fuelDate, site, product, vehicle, usageCount, quantity, unitPrice, supply, vat, total].join("|");',
        '    const fingerprintSite = hasSiteColumn ? site : "미지정";\n    const rawFingerprint = [stationName, fuelDate, fingerprintSite, product, vehicle, usageCount, quantity, unitPrice, supply, vat, total].join("|");',
    ),
    (
        '      memo: hasSiteColumn ? "" : "원본 명세서에 현장명 없음",',
        '      memo: hasSiteColumn ? "" : autoSite ? "원본 명세서에 현장명 없음 · 차량번호로 현장 자동지정" : "원본 명세서에 현장명 없음",',
    ),
]

for old, new in replacements:
    if new in s:
        continue
    if old not in s:
        raise SystemExit(f'fuel import patch anchor not found: {old[:60]}')
    s = s.replace(old, new, 1)

p.write_text(s)
