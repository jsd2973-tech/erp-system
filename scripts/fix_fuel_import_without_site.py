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
]

for old, new in replacements:
    if new in s:
        continue
    if old not in s:
        raise SystemExit(f'fuel import patch anchor not found: {old[:60]}')
    s = s.replace(old, new, 1)

p.write_text(s)
