from pathlib import Path

path = Path('src/features/dispatch/DispatchPage.tsx')
text = path.read_text(encoding='utf-8')

old_payload = '''  const saveDriver = async (driver: DispatchDriver) => {\n    setSaving(true);\n    const payload = { id: driver.id || createDispatchId(), name: driver.name, phone: driver.phone, assigned_vehicle_id: driver.assigned_vehicle_id, auth_user_id: driver.auth_user_id, active: driver.active, memo: driver.memo };'''
new_payload = '''  const saveDriver = async (driver: DispatchDriver) => {\n    setSaving(true);\n    const existingDriver = driver.id ? drivers.find((item) => item.id === driver.id) : undefined;\n    const authUserId = isAdmin ? driver.auth_user_id : (existingDriver?.auth_user_id ?? null);\n    const payload = { id: driver.id || createDispatchId(), name: driver.name, phone: driver.phone, assigned_vehicle_id: driver.assigned_vehicle_id, auth_user_id: authUserId, active: driver.active, memo: driver.memo };'''
if old_payload not in text:
    raise SystemExit('saveDriver payload target not found')
text = text.replace(old_payload, new_payload, 1)

old_render = '<DriverManagement drivers={drivers} vehicles={vehicles} saving={saving} onSave={saveDriver} />'
new_render = '<DriverManagement drivers={drivers} vehicles={vehicles} saving={saving} canManageAuthUserId={isAdmin} onSave={saveDriver} />'
if old_render not in text:
    raise SystemExit('DriverManagement render target not found')
text = text.replace(old_render, new_render, 1)

path.write_text(text, encoding='utf-8')
