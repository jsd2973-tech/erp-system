from pathlib import Path
p = Path('src/App.tsx')
s = p.read_text(encoding='utf-8')

s = s.replace('permissions: target.role === "field" ? (target.permissions || {}) : {},', 'permissions: target.permissions || {},', 1)

old_groups = '''  const fieldPermissionGroups = [
    { label: "구매", keys: ["new", "list", "status", "bulk_transfer", "receipt_photos", "vendor_accounts"] },
    { label: "카드", keys: ["card_use", "card_list", "card_stats"] },
    { label: "정비", keys: ["maint_new", "maint_list", "maint_stats", "maintenance_photos", "maintenance_schedule_new", "maintenance_schedules"] },
    { label: "공통·기초", keys: ["layout", "bid_notices", "vendors", "warehouse_groups", "items", "permits"] },
  ].map((group) => ({
    ...group,
    items: ERP_PERMISSION_MODULES.filter((module) => group.keys.includes(module.key)),
  }));'''
new_groups = '''  const dispatchPermissionKeys = [...DISPATCH_VIEWS];
  const fieldPermissionGroups = [
    { label: "운행관리", keys: dispatchPermissionKeys },
    { label: "구매", keys: ["new", "list", "status", "bulk_transfer", "receipt_photos", "vendor_accounts"] },
    { label: "카드", keys: ["card_use", "card_list", "card_stats"] },
    { label: "정비", keys: ["maint_new", "maint_list", "maint_stats", "maintenance_photos", "maintenance_schedule_new", "maintenance_schedules"] },
    { label: "공통·기초", keys: ["layout", "bid_notices", "vendors", "warehouse_groups", "items", "permits"] },
  ].map((group) => ({
    ...group,
    items: ERP_PERMISSION_MODULES.filter((module) => group.keys.includes(module.key as DispatchView)),
  }));
  const officeDispatchPermissionItems = ERP_PERMISSION_MODULES.filter((module) => dispatchPermissionKeys.includes(module.key as DispatchView));'''
if old_groups not in s:
    raise SystemExit('permission groups block not found')
s = s.replace(old_groups, new_groups, 1)

old_desc = '<p>직원 아이디와 역할을 등록하고, 현장직원에게 필요한 메뉴만 선택해 허용합니다.</p>'
new_desc = '<p>직원 아이디와 역할을 등록하고, 운행관리는 직원별로 허용할 메뉴를 직접 선택합니다.</p>'
s = s.replace(old_desc, new_desc, 1)

old_ui_end = '''        {permissionForm.role === "field" && (
          <div className="permission-checks">
            <div className="permission-default-access"><b>기본 허용</b><span>홈 · 공지</span></div>
            {fieldPermissionGroups.map((group) => (
              <div className="permission-check-group" key={group.label}>
                <strong>{group.label}</strong>
                <div>
                  {group.items.map((m) => (
                    <label key={m.key}>
                      <input type="checkbox" checked={!!permissionForm.permissions?.[m.key]} onChange={() => togglePermission(m.key)} />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}'''
new_ui_end = '''        {permissionForm.role === "field" && (
          <div className="permission-checks">
            <div className="permission-default-access"><b>기본 허용</b><span>홈 · 공지</span></div>
            {fieldPermissionGroups.map((group) => (
              <div className="permission-check-group" key={group.label}>
                <strong>{group.label}</strong>
                <div>
                  {group.items.map((m) => (
                    <label key={m.key}>
                      <input type="checkbox" checked={!!permissionForm.permissions?.[m.key]} onChange={() => togglePermission(m.key)} />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {permissionForm.role === "office" && (
          <div className="permission-checks">
            <div className="permission-default-access"><b>사무실 기본 권한</b><span>기존 사무실 메뉴는 유지하고, 운행관리만 아래에서 별도 선택합니다.</span></div>
            <div className="permission-check-group">
              <strong>운행관리</strong>
              <div>
                {officeDispatchPermissionItems.map((m) => (
                  <label key={m.key}>
                    <input type="checkbox" checked={!!permissionForm.permissions?.[m.key]} onChange={() => togglePermission(m.key)} />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}'''
if old_ui_end not in s:
    raise SystemExit('permission checkbox UI block not found')
s = s.replace(old_ui_end, new_ui_end, 1)

old_status = '<em className="permission-row-status">{item.role === "field" ? `${Object.values(item.permissions || {}).filter(Boolean).length}개 메뉴 허용` : "수정·삭제 제외 가능"}</em>'
new_status = '<em className="permission-row-status">{item.role === "field" ? `${Object.values(item.permissions || {}).filter(Boolean).length}개 메뉴 허용` : `운행관리 ${DISPATCH_VIEWS.filter((key) => item.permissions?.[key]).length}개 허용 · 기본 사무실 권한`}</em>'
if old_status not in s:
    raise SystemExit('permission row status not found')
s = s.replace(old_status, new_status, 1)

p.write_text(s, encoding='utf-8')
