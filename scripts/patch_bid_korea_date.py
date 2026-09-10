from pathlib import Path
import re

p = Path("src/App.tsx")
s = p.read_text(encoding="utf-8")

helper_pattern = re.compile(
    r"const toBidDateInput = \(date: Date\) => \{.*?\n\};\n\nconst getBidQuickRange = \(days: number\) => \{.*?\n\};",
    re.S,
)
helper_replacement = '''const BID_FOLLOW_TODAY_KEY = "erp_bid_follow_today_v1";

const toBidDateInput = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const getBidQuickRange = (days: number) => {
  const toKey = toBidDateInput(new Date());
  const to = new Date(`${toKey}T00:00:00+09:00`);
  const from = new Date(to.getTime() - Math.max(0, days - 1) * 86400000);
  return { from: toBidDateInput(from), to: toKey };
};'''
s, count = helper_pattern.subn(helper_replacement, s, count=1)
if count != 1:
    raise SystemExit(f"bid helper replacement count={count}")

marker = '  const [bidFetchedAt, setBidFetchedAt] = useState("");\n'
if marker not in s:
    raise SystemExit("bidFetchedAt marker not found")
s = s.replace(
    marker,
    marker + '  const [bidFollowToday, setBidFollowToday] = useState(() => window.localStorage.getItem(BID_FOLLOW_TODAY_KEY) !== "0");\n',
    1,
)

effects_marker = '''  useEffect(() => {
    window.localStorage.setItem("erp_bid_filter_settings_v1", JSON.stringify(bidFilters));
  }, [bidFilters]);

  const setQuickRange = (days: number) => {
    setBidFilters((current) => ({ ...current, ...getBidQuickRange(days) }));
  };'''
effects_replacement = '''  useEffect(() => {
    window.localStorage.setItem("erp_bid_filter_settings_v1", JSON.stringify(bidFilters));
  }, [bidFilters]);

  useEffect(() => {
    if (!bidFollowToday) return;

    const syncBidRangeToKoreaToday = () => {
      const today = toBidDateInput(new Date());
      setBidFilters((current) => {
        if (current.to === today) return current;
        const fromTime = new Date(`${current.from}T00:00:00+09:00`).getTime();
        const toTime = new Date(`${current.to}T00:00:00+09:00`).getTime();
        const rangeDays = Number.isFinite(fromTime) && Number.isFinite(toTime)
          ? Math.min(90, Math.max(1, Math.round((toTime - fromTime) / 86400000) + 1))
          : 30;
        return { ...current, ...getBidQuickRange(rangeDays) };
      });
    };

    syncBidRangeToKoreaToday();
    const timer = window.setInterval(syncBidRangeToKoreaToday, 10000);
    window.addEventListener("focus", syncBidRangeToKoreaToday);
    document.addEventListener("visibilitychange", syncBidRangeToKoreaToday);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", syncBidRangeToKoreaToday);
      document.removeEventListener("visibilitychange", syncBidRangeToKoreaToday);
    };
  }, [bidFollowToday]);

  const setQuickRange = (days: number) => {
    setBidFollowToday(true);
    window.localStorage.setItem(BID_FOLLOW_TODAY_KEY, "1");
    setBidFilters((current) => ({ ...current, ...getBidQuickRange(days) }));
  };

  const setBidDateManually = (key: "from" | "to", value: string) => {
    setBidFollowToday(false);
    window.localStorage.setItem(BID_FOLLOW_TODAY_KEY, "0");
    setBidFilters((current) => ({ ...current, [key]: value }));
  };'''
if effects_marker not in s:
    raise SystemExit("bid effects marker not found")
s = s.replace(effects_marker, effects_replacement, 1)

old_from = 'onChange={(event) => setBidFilters((current) => ({ ...current, from: event.target.value }))} aria-label="입찰공고 조회 시작일"'
new_from = 'onChange={(event) => setBidDateManually("from", event.target.value)} aria-label="입찰공고 조회 시작일"'
old_to = 'onChange={(event) => setBidFilters((current) => ({ ...current, to: event.target.value }))} aria-label="입찰공고 조회 종료일"'
new_to = 'onChange={(event) => setBidDateManually("to", event.target.value)} aria-label="입찰공고 조회 종료일"'
if old_from not in s or old_to not in s:
    raise SystemExit("bid date input marker not found")
s = s.replace(old_from, new_from, 1).replace(old_to, new_to, 1)

p.write_text(s, encoding="utf-8")
