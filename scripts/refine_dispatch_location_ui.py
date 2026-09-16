from pathlib import Path
import re

# Refine the reverse-geocoded address stored when a driver completes loading/unloading.
# Keep country/postcode out, prefer Korean administrative order, and append a useful
# nearby place name only when it adds information.
path = Path('src/features/dispatch/DriverMobileApp.tsx')
s = path.read_text()
pattern = re.compile(r'''const formatReverseAddress = \(data: Record<string, unknown>\) => \{.*?\n\};''', re.S)
replacement = '''const formatReverseAddress = (data: Record<string, unknown>) => {
  const address = (data.address || {}) as Record<string, string>;
  const region = address.state || address.province || address.region || "";
  const city = address.city || address.county || address.municipality || "";
  const local = address.town || address.village || address.suburb || address.quarter || address.hamlet || "";
  const neighborhood = address.neighbourhood || address.residential || address.industrial || address.isolated_dwelling || "";
  const road = address.road || address.pedestrian || address.path || "";
  const house = address.house_number || "";
  const mappedLandmark = address.bridge || address.building || address.amenity || address.place || address.shop || address.office || "";
  const responseName = typeof data.name === "string" ? data.name.trim() : "";
  const mainParts = [region, city, local, neighborhood, road, house]
    .map((value) => value?.trim())
    .filter(Boolean);
  const uniqueMain = [...new Set(mainParts)];
  const landmark = (mappedLandmark || responseName).trim();
  if (landmark && !uniqueMain.some((part) => part === landmark || part.includes(landmark) || landmark.includes(part))) {
    uniqueMain.push(`(${landmark})`);
  }
  if (uniqueMain.length) return uniqueMain.join(" ");

  const displayName = typeof data.display_name === "string" ? data.display_name : "";
  return displayName
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && part !== "대한민국" && !/^\\d{5}$/.test(part))
    .reverse()
    .join(" ") || null;
};'''
if not pattern.search(s):
    raise SystemExit('reverse address formatter not found')
s = pattern.sub(lambda _match: replacement, s, count=1)
path.write_text(s)

# Add a dedicated location-view permission to the existing administrator permission screen.
# Admin accounts still see locations automatically; this checkbox is for additional staff.
path = Path('src/App.tsx')
s = path.read_text()
module_anchor = '  { key: "dispatch_results", label: "운행관리 · 운송실적" },'
module_line = '  { key: "dispatch_location", label: "운행관리 · 위치조회" },'
if module_line not in s:
    if module_anchor not in s:
        raise SystemExit('permission module anchor not found')
    s = s.replace(module_anchor, module_anchor + '\n' + module_line, 1)

old_keys = '  const dispatchPermissionKeys = [...DISPATCH_VIEWS];'
new_keys = '  const dispatchPermissionKeys = [...DISPATCH_VIEWS, "dispatch_location"];'
if new_keys not in s:
    if old_keys not in s:
        raise SystemExit('dispatch permission key anchor not found')
    s = s.replace(old_keys, new_keys, 1)

path.write_text(s)
