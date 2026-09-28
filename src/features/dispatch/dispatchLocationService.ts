export type TripLocationCapture = {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string | null;
};

const formatReverseAddress = (data: Record<string, unknown>) => {
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
    .filter((part) => part && part !== "대한민국" && !/^\d{5}$/.test(part))
    .reverse()
    .join(" ") || null;
};

export const captureTripLocation = () => new Promise<TripLocationCapture>((resolve, reject) => {
  if (!("geolocation" in navigator)) { reject(new Error("이 휴대폰에서는 위치 확인을 지원하지 않습니다.")); return; }
  navigator.geolocation.getCurrentPosition(async (position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    let address: string | null = null;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=ko`);
      if (response.ok) address = formatReverseAddress(await response.json() as Record<string, unknown>);
    } catch {
      address = null;
    }
    resolve({ latitude, longitude, accuracy: position.coords.accuracy, address });
  }, (geoError) => {
    const message = geoError.code === geoError.PERMISSION_DENIED
      ? "상차·하차 완료 처리를 위해 위치 권한을 허용해 주세요."
      : geoError.code === geoError.POSITION_UNAVAILABLE
        ? "현재 위치를 확인할 수 없습니다. 휴대폰 위치 서비스를 켜고 다시 시도해 주세요."
        : "위치 확인 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.";
    reject(new Error(message));
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
});
