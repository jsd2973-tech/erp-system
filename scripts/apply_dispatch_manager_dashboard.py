from pathlib import Path

path = Path('src/App.tsx')
s = path.read_text()

import_anchor = 'import DispatchPage from "./features/dispatch/DispatchPage";'
import_line = 'import DispatchManagerDashboard from "./features/dispatch/DispatchManagerDashboard";'
if import_line not in s:
    if import_anchor not in s:
        raise SystemExit('dispatch import anchor not found')
    s = s.replace(import_anchor, import_anchor + '\n' + import_line, 1)

old = '{menuTab === "home" && <HomeDashboard purchases={purchases} maints={maints} cardUses={cardUses} maintenanceSchedules={maintenanceSchedules} receiptPhotos={receiptPhotos} maintenancePhotos={maintenancePhotos} siteNotices={visibleSiteNotices} deletedRecords={deletedRecords} setMenuTab={setMenuTab} currentRole={currentRole}  logout={logout} />}'
new = '{menuTab === "home" && (currentRole === "dispatch_manager" ? <DispatchManagerDashboard supabase={supabase} onNavigate={(view) => setMenuTab(view)} /> : <HomeDashboard purchases={purchases} maints={maints} cardUses={cardUses} maintenanceSchedules={maintenanceSchedules} receiptPhotos={receiptPhotos} maintenancePhotos={maintenancePhotos} siteNotices={visibleSiteNotices} deletedRecords={deletedRecords} setMenuTab={setMenuTab} currentRole={currentRole}  logout={logout} />)}'
if 'currentRole === "dispatch_manager" ? <DispatchManagerDashboard' not in s:
    if old not in s:
        raise SystemExit('home dashboard anchor not found')
    s = s.replace(old, new, 1)

path.write_text(s)
