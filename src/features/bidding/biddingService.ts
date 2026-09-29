import type {
  BidApiTarget,
  BidDiagnostics,
  BidFilters,
  BidKeywords,
  BidLoadState,
  BidNotice,
  BidSourceStatus,
} from "./biddingTypes";

type BidApiDiagnostics = {
  receivedCount?: number;
  failedCalls?: number;
  failedPages?: number;
  truncated?: boolean;
  partial?: boolean;
};

type BidApiPayload = {
  error?: string;
  notices?: unknown;
  diagnostics?: BidApiDiagnostics;
  sourceStatus?: Partial<Record<BidApiTarget, Partial<BidSourceStatus>>>;
  failedCalls?: number;
  partial?: boolean;
  truncated?: boolean;
};

export type BidNoticeLoadResult = {
  notices: BidNotice[];
  diagnostics: BidDiagnostics;
  loadState: BidLoadState;
  error: string;
};

export const loadBidNotices = async (
  filters: Pick<BidFilters, "from" | "to">,
  keywords: BidKeywords,
  fetcher: typeof fetch = fetch,
): Promise<BidNoticeLoadResult> => {
  const params = new URLSearchParams({
    include: keywords.include.join(","),
    exclude: keywords.exclude.join(","),
    from: filters.from,
    to: filters.to,
  });
  const targets: BidApiTarget[] = ["g2b", "lh"];
  const results = await Promise.allSettled(targets.map(async (target) => {
    const response = await fetcher("/api/" + target + "?" + params.toString());
    const payload = await response.json().catch((): BidApiPayload => ({}));
    if (!response.ok) {
      throw new Error((target === "lh" ? "LH" : "나라장터") + ": "
        + (payload?.error || "공고 조회 실패 (" + response.status + ")"));
    }
    return { target, payload: payload as BidApiPayload };
  }));
  const successful = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);

  if (!successful.length) {
    const sourceStatus = Object.fromEntries(targets.map((target) => [
      target,
      { status: "failed" as const, failedCalls: 1 },
    ]));
    return {
      notices: [],
      diagnostics: {
        receivedCount: 0,
        matchedCount: 0,
        failedCalls: results.length,
        failedPages: 0,
        truncated: false,
        partial: true,
        sourceStatus,
      },
      loadState: "failed",
      error: "나라장터와 LH 공고를 불러오지 못했습니다. 잠시 후 다시 새로고침해 주세요.",
    };
  }

  const notices = successful
    .flatMap(({ payload }) => Array.isArray(payload?.notices) ? payload.notices as BidNotice[] : [])
    .sort((a, b) => String(b.noticeDate || "").localeCompare(String(a.noticeDate || "")));

  const sourceStatus = Object.fromEntries(targets.map((target) => {
    const result = successful.find((item) => item.target === target);
    if (!result) return [target, { status: "failed" as const, failedCalls: 1 }];
    const diagnostics = result.payload?.diagnostics || {};
    const source = result.payload?.sourceStatus?.[target] || {};
    const status = source.status === "failed"
      ? "failed" as const
      : source.status === "partial" || diagnostics.partial || diagnostics.truncated
          || result.payload?.partial || result.payload?.truncated
        ? "partial" as const
        : "normal" as const;
    return [target, {
      status,
      failedCalls: Number(source.failedCalls ?? diagnostics.failedCalls ?? result.payload?.failedCalls ?? 0),
      failedPages: Number(source.failedPages ?? diagnostics.failedPages ?? 0),
      truncated: Boolean(source.truncated ?? diagnostics.truncated ?? result.payload?.truncated),
    }];
  }));
  const failedCalls = results.filter((result) => result.status === "rejected").length
    + successful.reduce((count, result) => count
      + Number(result.payload?.diagnostics?.failedCalls ?? result.payload?.failedCalls ?? 0), 0);
  const failedPages = successful.reduce((count, result) => count
    + Number(result.payload?.diagnostics?.failedPages || 0), 0);
  const truncated = successful.some((result) => Boolean(
    result.payload?.diagnostics?.truncated ?? result.payload?.truncated,
  ));
  const partial = results.some((result) => result.status === "rejected")
    || successful.some((result) => Boolean(
      result.payload?.diagnostics?.partial ?? result.payload?.partial ?? result.payload?.truncated,
    ));
  const diagnostics: BidDiagnostics = {
    receivedCount: successful.reduce((count, result) => count
      + Number(result.payload?.diagnostics?.receivedCount || 0), 0),
    matchedCount: notices.length,
    failedCalls,
    failedPages,
    truncated,
    partial,
    sourceStatus,
  };
  return {
    notices,
    diagnostics,
    loadState: partial ? "partial" : "normal",
    error: partial ? "일부 공고 조회가 완료되지 않았습니다. 새로고침 후 다시 확인해 주세요." : "",
  };
};
