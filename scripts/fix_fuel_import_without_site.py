from pathlib import Path

p = Path('src/features/fuel/FuelManagement.tsx')
s = p.read_text()

old = 'return candidateText.includes("차량번호") && candidateText.includes("합계금액") && candidateText.includes("현장명");'
new = 'return candidateText.includes("차량번호") && candidateText.includes("합계금액") && (candidateText.includes("현장명") || candidateText.includes("제품명"));'
if old not in s:
    raise SystemExit('html table matcher anchor not found')
s = s.replace(old, new, 1)

old = 'return normalized.includes("현장명") && normalized.includes("차량번호") && normalized.includes("일자");'
new = 'return normalized.includes("차량번호") && normalized.includes("일자") && normalized.some((header) => header.includes("제품명"));'
if old not in s:
    raise SystemExit('header matcher anchor not found')
s = s.replace(old, new, 1)

old = 'if (headerIndex < 0) throw new Error("현장명·차량번호·일자 헤더를 찾지 못했습니다.");'
new = 'if (headerIndex < 0) throw new Error("제품명·차량번호·일자 헤더를 찾지 못했습니다.");'
if old not in s:
    raise SystemExit('header error anchor not found')
s = s.replace(old, new, 1)

old = 'if ([columns.site, columns.product, columns.vehicle, columns.date, columns.quantity, columns.total].some((value) => value < 0)) {'
new = 'if ([columns.product, columns.vehicle, columns.date, columns.quantity, columns.total].some((value) => value < 0)) {'
if old not in s:
    raise SystemExit('required columns anchor not found')
s = s.replace(old, new, 1)

old = '  let lastSite = "";\n  let lastProduct = "";'
new = '  const hasSiteColumn = columns.site >= 0;\n  let lastSite = hasSiteColumn ? "" : "미지정";\n  let lastProduct = "";'
if old not in s:
    raise SystemExit('lastSite anchor not found')
s = s.replace(old, new, 1)

old = '      memo: "",\n    });'
new = '      memo: hasSiteColumn ? "" : "원본 명세서에 현장명 없음",\n    });'
if old not in s:
    raise SystemExit('memo anchor not found')
s = s.replace(old, new, 1)

p.write_text(s)
