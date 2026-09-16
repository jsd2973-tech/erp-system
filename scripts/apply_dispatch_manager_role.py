from pathlib import Path

path = Path('src/App.tsx')
s = path.read_text()

# 1) Role type
s = s.replace('type UserRole = "admin" | "office" | "field";', 'type UserRole = "admin" | "office" | "field" | "dispatch_manager";', 1)

# 2) Access rules: dispatch manager sees only dispatch pages and starts on dispatch status.
old = '''  const canAccessTab = (tab: string) => {\n    if (!isPermissionApproved) return false;\n    if (!tab) return true;\n    if (tab === "home") return true;\n    if (tab === "site_notices") return true;'''
new = '''  const canAccessTab = (tab: string) => {\n    if (!isPermissionApproved) return false;\n    if (!tab) return true;\n    if (currentRole === "dispatch_manager") return DISPATCH_VIEWS.includes(tab as DispatchView);\n    if (tab === "home") return true;\n    if (tab === "site_notices") return true;'''
if old not in s:
    raise SystemExit('canAccessTab anchor not found')
s = s.replace(old, new, 1)

s = s.replace('''  const getFirstAllowedTab = () => {\n    if (isAdmin || currentRole === "office") return "home";\n    return "home";\n  };''', '''  const getFirstAllowedTab = () => {\n    if (currentRole === "dispatch_manager") return "dispatch_status";\n    if (isAdmin || currentRole === "office") return "home";\n    return "home";\n  };''', 1)

# 3) Save dispatch manager with all dispatch + location permissions so DB/RLS permission checks work.
old = '      permissions: target.permissions || {},'
new = '''      permissions: target.role === "dispatch_manager" ? {\n        dispatch_register: true, dispatch_list: true, dispatch_status: true, dispatch_results: true,\n        dispatch_vehicles: true, dispatch_drivers: true, dispatch_basics: true, dispatch_location: true,\n      } : (target.permissions || {}),'''
if old not in s:
    raise SystemExit('save permission anchor not found')
s = s.replace(old, new, 1)

# 4) Add role option in permissions screen.
anchor = '<option value="office">사무실직원</option>\n              <option value="field">현장직원</option>'
replacement = '<option value="office">사무실직원</option>\n              <option value="dispatch_manager">배차관리자</option>\n              <option value="field">현장직원</option>'
if anchor not in s:
    raise SystemExit('role option anchor not found')
s = s.replace(anchor, replacement, 1)

# 5) Permission screen: dispatch manager role description / fixed full dispatch access.
anchor = '''        {permissionForm.role === "office" && (\n          <div className="permission-checks">'''
insert = '''        {permissionForm.role === "dispatch_manager" && (\n          <div className="permission-checks">\n            <div className="permission-default-access"><b>배차관리자 전용</b><span>운행관리 전 메뉴 · 상하차 위치조회가 기본 허용됩니다. 구매·카드·정비·유류·백업 메뉴는 표시되지 않습니다.</span></div>\n          </div>\n        )}\n\n        {permissionForm.role === "office" && (\n          <div className="permission-checks">'''
if anchor not in s:
    raise SystemExit('office permission block anchor not found')
s = s.replace(anchor, insert, 1)

# 6) Role label in desktop user box.
old = 'currentRole === "admin" ? " · 관리자" : currentRole === "office" ? " · 사무실직원" : " · 현장직원"'
new = 'currentRole === "admin" ? " · 관리자" : currentRole === "office" ? " · 사무실직원" : currentRole === "dispatch_manager" ? " · 배차관리자" : " · 현장직원"'
if old not in s:
    raise SystemExit('role label anchor not found')
s = s.replace(old, new, 1)

# 7) Mobile bottom nav: dedicated dispatch-manager controls.
anchor = '{currentRole === "field" ? ('
replacement = '''{currentRole === "dispatch_manager" ? (\n            <>\n              <button className={menuTab === "dispatch_status" ? "active" : ""} onClick={() => { setMenuTab("dispatch_status"); setMobileSheet(""); }}>운행현황</button>\n              <button className={menuTab === "dispatch_register" ? "active" : ""} onClick={() => { setMenuTab("dispatch_register"); setMobileSheet(""); }}>배차등록</button>\n              <button className={menuTab === "dispatch_list" ? "active" : ""} onClick={() => { setMenuTab("dispatch_list"); setMobileSheet(""); }}>배차목록</button>\n              <button className={menuTab === "dispatch_results" ? "active" : ""} onClick={() => { setMenuTab("dispatch_results"); setMobileSheet(""); }}>운송실적</button>\n              <button className={["dispatch_vehicles","dispatch_drivers","dispatch_basics"].includes(menuTab) ? "active" : ""} onClick={() => setMobileSheet(mobileSheet === "more" ? "" : "more")}>더보기</button>\n            </>\n          ) : currentRole === "field" ? ('''
if anchor not in s:
    raise SystemExit('mobile nav anchor not found')
s = s.replace(anchor, replacement, 1)

# 8) Mobile sheet: when dispatch manager opens More, show only vehicle/driver/basic + alerts/logout.
# Insert a dedicated set at the beginning of existing more-sheet content; generic content is hidden by canAccessTab.
more_anchor = '{mobileSheet === "more" && <div className="mobile-menu-footer">'
more_replacement = '''{mobileSheet === "more" && currentRole === "dispatch_manager" && (\n              <div className="dispatch-manager-mobile-more">\n                <button type="button" onClick={() => { setMenuTab("dispatch_vehicles"); setMobileSheet(""); }}>차량관리</button>\n                <button type="button" onClick={() => { setMenuTab("dispatch_drivers"); setMobileSheet(""); }}>기사관리</button>\n                <button type="button" onClick={() => { setMenuTab("dispatch_basics"); setMobileSheet(""); }}>배차 기초관리</button>\n              </div>\n            )}\n            {mobileSheet === "more" && <div className="mobile-menu-footer">'''
if more_anchor not in s:
    raise SystemExit('mobile more footer anchor not found')
s = s.replace(more_anchor, more_replacement, 1)

path.write_text(s)
