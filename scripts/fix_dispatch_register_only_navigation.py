from pathlib import Path
p = Path('src/features/dispatch/DispatchPage.tsx')
s = p.read_text(encoding='utf-8')
old = '''    onNotify(form.id ? "배차를 수정했습니다." : "배차를 등록했습니다.");\n    onNavigate("dispatch_list");\n    return true;'''
new = '''    onNotify(form.id ? "배차를 수정했습니다." : "배차를 등록했습니다.");\n    if (allowedViews.includes("dispatch_list")) onNavigate("dispatch_list");\n    return true;'''
if old not in s:
    raise SystemExit('target not found')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
