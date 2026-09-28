export type BidRegionFilter = "local" | "all" | "daejeon" | "sejong" | "chungnam";
export type BidSourceFilter = "all" | "g2b" | "lh";
export type BidLoadState = "idle" | "normal" | "partial" | "failed";
export type BidKeywordKind = "include" | "exclude";
export type BidApiTarget = "g2b" | "lh";

export type BidNotice = {
  id: string;
  source: string;
  businessType: string;
  bidNo: string;
  title: string;
  agency: string;
  regionText?: string;
  matchedBy?: string[];
  noticeDate: string;
  deadline: string;
  amount: number;
  url: string;
  status?: "진행중" | "마감";
  isNew?: boolean;
  deadlineBadge?: string;
};

export type BidSourceStatus = {
  status: "normal" | "partial" | "failed";
  failedCalls?: number;
  failedPages?: number;
  truncated?: boolean;
};

export type BidDiagnostics = {
  receivedCount: number;
  matchedCount: number;
  failedCalls: number;
  failedPages: number;
  truncated: boolean;
  partial: boolean;
  sourceStatus: Record<string, BidSourceStatus>;
};

export type BidFilters = {
  region: BidRegionFilter;
  from: string;
  to: string;
};

export type BidKeywords = {
  include: string[];
  exclude: string[];
};
