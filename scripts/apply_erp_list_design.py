from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "src" / "App.tsx"
app = APP_PATH.read_text(encoding="utf-8")

MARKER = "/* ===== ERP List Pages: Unified Detail Layout ===== */"
if MARKER in app:
    print("ERP 목록 공통 디자인 패치가 이미 적용되어 있습니다.")
    raise SystemExit(0)


CSS = r'''
/* ===== ERP List Pages: Unified Detail Layout ===== */
/* 목록·세부목록 화면만 대상으로 하는 최종 공통 스타일입니다. 데이터/권한/동작은 변경하지 않습니다. */
.app.app-tab-list,
.app.app-tab-status,
.app.app-tab-card_list,
.app.app-tab-card_stats,
.app.app-tab-maint_list,
.app.app-tab-maint_stats,
.app.app-tab-maintenance_schedules,
.app.app-tab-permits,
.app.app-tab-receipt_photos,
.app.app-tab-maintenance_photos,
.app.app-tab-vendor_accounts,
.app.app-tab-bulk_transfer,
.app.app-tab-trash_bin,
.app.app-tab-activity_logs,
.app.app-tab-vendors,
.app.app-tab-warehouse_groups,
.app.app-tab-items,
.app.app-tab-site_notices,
.app.app-tab-bid_notices,
.app.app-tab-update_history,
.app.app-tab-update_notices,
.app.app-tab-backup_permissions{
  --erp-list-line:#e3eaf2;
  --erp-list-soft:#f7faff;
  --erp-list-muted:#718096;
  --erp-list-ink:#172033;
}

/* PC: 화면마다 같은 폭·외곽선·제목/목록 리듬을 사용합니다. */
@media (min-width:901px){
  .app.app-tab-list>.lookup-page,
  .app.app-tab-status>.card,
  .app.app-tab-card_list>.lookup-page,
  .app.app-tab-card_stats>.card,
  .app.app-tab-maint_list>.lookup-page,
  .app.app-tab-maint_stats>.card,
  .app.app-tab-permits>.permit-page,
  .app.app-tab-receipt_photos>.receipt-photo-page,
  .app.app-tab-maintenance_photos>.receipt-photo-page,
  .app.app-tab-vendor_accounts>.vendor-account-page,
  .app.app-tab-bulk_transfer>.bulk-transfer-page,
  .app.app-tab-trash_bin>.trash-page,
  .app.app-tab-activity_logs>.activity-log-page,
  .app.app-tab-vendors>.basic-master-page,
  .app.app-tab-warehouse_groups>.basic-master-page,
  .app.app-tab-items>.basic-master-page{
    border-color:var(--erp-list-line);
    box-shadow:0 10px 30px rgba(15,23,42,.045);
  }

  .app.app-tab-list>.lookup-page>.between:first-child,
  .app.app-tab-status>.card>.between:first-child,
  .app.app-tab-card_list>.lookup-page>.between:first-child,
  .app.app-tab-card_stats>.card>.between:first-child,
  .app.app-tab-maint_list>.lookup-page>.between:first-child,
  .app.app-tab-maint_stats>.card>.between:first-child,
  .app.app-tab-permits .permit-head,
  .app.app-tab-vendor_accounts .vendor-account-head,
  .app.app-tab-bulk_transfer .bulk-transfer-head,
  .app.app-tab-trash_bin>.trash-page>.between:first-child,
  .app.app-tab-activity_logs>.activity-log-page>.between:first-child{
    position:relative;
    margin-bottom:20px !important;
    padding-bottom:16px !important;
    border-bottom:1px solid var(--erp-list-line);
  }

  .app.app-tab-list>.lookup-page>.between:first-child h2,
  .app.app-tab-status>.card>.between:first-child h2,
  .app.app-tab-card_list>.lookup-page>.between:first-child h2,
  .app.app-tab-card_stats>.card>.between:first-child h2,
  .app.app-tab-maint_list>.lookup-page>.between:first-child h2,
  .app.app-tab-maint_stats>.card>.between:first-child h2{
    color:var(--erp-list-ink);
    font-size:25px;
    font-weight:950;
    letter-spacing:-.7px;
  }

  .app.app-tab-list>.lookup-page>.grid5,
  .app.app-tab-status>.card>.grid5,
  .app.app-tab-card_list>.lookup-page>.grid5,
  .app.app-tab-card_stats>.card>.grid5,
  .app.app-tab-maint_stats>.card>.grid5,
  .app.app-tab-maint_list .maint-filter,
  .app.app-tab-permits>.permit-page>.grid5,
  .app.app-tab-permits>.permit-page>.grid3,
  .app.app-tab-trash_bin>.trash-page>.grid3,
  .app.app-tab-activity_logs>.activity-log-page>.grid3{
    margin-bottom:18px;
    padding:15px 16px;
    border:1px solid var(--erp-list-line);
    border-radius:14px;
    background:var(--erp-list-soft);
  }

  .app.app-tab-maint_list .maint-filter{
    grid-template-columns:minmax(150px,.7fr) minmax(150px,.7fr) minmax(190px,1fr) minmax(220px,1.35fr) 120px;
    gap:12px;
  }

  .app.app-tab-list>.lookup-page>.grid5 .field,
  .app.app-tab-status>.card>.grid5 .field,
  .app.app-tab-card_list>.lookup-page>.grid5 .field,
  .app.app-tab-card_stats>.card>.grid5 .field,
  .app.app-tab-maint_stats>.card>.grid5 .field,
  .app.app-tab-maint_list .maint-filter .field,
  .app.app-tab-permits>.permit-page>.grid5 .field,
  .app.app-tab-permits>.permit-page>.grid3 .field,
  .app.app-tab-trash_bin>.trash-page>.grid3 .field,
  .app.app-tab-activity_logs>.activity-log-page>.grid3 .field{
    margin:0;
  }

  .app.app-tab-list .scroll-table,
  .app.app-tab-status .scroll-table,
  .app.app-tab-card_list .scroll-table,
  .app.app-tab-card_stats .scroll-table,
  .app.app-tab-maint_list .scroll-table,
  .app.app-tab-maint_stats .scroll-table,
  .app.app-tab-permits .scroll-table,
  .app.app-tab-trash_bin .scroll-table,
  .app.app-tab-activity_logs .scroll-table,
  .app.app-tab-vendors .basic-table-scroll,
  .app.app-tab-warehouse_groups .basic-table-scroll,
  .app.app-tab-items .basic-table-scroll{
    margin-top:0;
    overflow:auto;
    border:1px solid var(--erp-list-line);
    border-radius:13px;
    box-shadow:0 4px 14px rgba(15,23,42,.025);
  }

  .app.app-tab-list .scroll-table th,
  .app.app-tab-status .scroll-table th,
  .app.app-tab-card_list .scroll-table th,
  .app.app-tab-card_stats .scroll-table th,
  .app.app-tab-maint_list .scroll-table th,
  .app.app-tab-maint_stats .scroll-table th,
  .app.app-tab-permits .scroll-table th,
  .app.app-tab-trash_bin .scroll-table th,
  .app.app-tab-activity_logs .scroll-table th,
  .app.app-tab-vendors .basic-table-scroll th,
  .app.app-tab-warehouse_groups .basic-table-scroll th,
  .app.app-tab-items .basic-table-scroll th{
    height:44px;
    padding:10px 9px;
    background:#eef4fa;
    color:#40516a;
    font-size:12px;
    font-weight:950;
    text-align:center;
    vertical-align:middle;
  }

  .app.app-tab-list .scroll-table td,
  .app.app-tab-status .scroll-table td,
  .app.app-tab-card_list .scroll-table td,
  .app.app-tab-card_stats .scroll-table td,
  .app.app-tab-maint_list .scroll-table td,
  .app.app-tab-maint_stats .scroll-table td,
  .app.app-tab-permits .scroll-table td,
  .app.app-tab-trash_bin .scroll-table td,
  .app.app-tab-activity_logs .scroll-table td,
  .app.app-tab-vendors .basic-table-scroll td,
  .app.app-tab-warehouse_groups .basic-table-scroll td,
  .app.app-tab-items .basic-table-scroll td{
    min-height:44px;
    padding:9px 8px;
    color:#334155;
    font-size:13px;
    text-align:center;
    vertical-align:middle;
  }

  .app.app-tab-list .scroll-table tbody tr:hover td,
  .app.app-tab-status .scroll-table tbody tr:hover td,
  .app.app-tab-card_list .scroll-table tbody tr:hover td,
  .app.app-tab-card_stats .scroll-table tbody tr:hover td,
  .app.app-tab-maint_list .scroll-table tbody tr:hover td,
  .app.app-tab-maint_stats .scroll-table tbody tr:hover td,
  .app.app-tab-permits .scroll-table tbody tr:hover td,
  .app.app-tab-trash_bin .scroll-table tbody tr:hover td,
  .app.app-tab-activity_logs .scroll-table tbody tr:hover td,
  .app.app-tab-vendors .basic-table-scroll tbody tr:hover td,
  .app.app-tab-warehouse_groups .basic-table-scroll tbody tr:hover td,
  .app.app-tab-items .basic-table-scroll tbody tr:hover td{
    background:#f8fbff;
  }

  .app.app-tab-status>.card>h3,
  .app.app-tab-card_stats>.card>h3,
  .app.app-tab-maint_stats>.card>h3,
  .app.app-tab-maint_list .basic-list-heading{
    margin:22px 0 10px;
    padding:0 0 10px;
    border-bottom:1px solid #edf1f5;
    color:#26364d;
    font-size:17px;
    font-weight:950;
  }

  .app.app-tab-status>.card>.status-cards,
  .app.app-tab-card_list>.lookup-page>.status-cards,
  .app.app-tab-card_stats>.card>.status-cards,
  .app.app-tab-maint_stats>.card>.status-cards{
    gap:10px;
    margin:0 0 20px;
  }

  .app.app-tab-status>.card>.status-cards>div,
  .app.app-tab-card_list>.lookup-page>.status-cards>div,
  .app.app-tab-card_stats>.card>.status-cards>div,
  .app.app-tab-maint_stats>.card>.status-cards>div{
    min-height:82px;
    padding:14px 15px;
    border-color:var(--erp-list-line);
    background:linear-gradient(180deg,#fbfdff,#f5f8fc);
  }

  .app.app-tab-status>.card>.status-cards span,
  .app.app-tab-card_list>.lookup-page>.status-cards span,
  .app.app-tab-card_stats>.card>.status-cards span,
  .app.app-tab-maint_stats>.card>.status-cards span{
    font-size:11px;
    font-weight:900;
  }

  .app.app-tab-status>.card>.status-cards b,
  .app.app-tab-card_list>.lookup-page>.status-cards b,
  .app.app-tab-card_stats>.card>.status-cards b,
  .app.app-tab-maint_stats>.card>.status-cards b{
    color:#1d4ed8;
    font-size:20px;
    line-height:1.25;
  }

  .app.app-tab-list .purchase-page-summary{
    margin:0 0 10px;
    color:#718096;
    font-size:12px;
    font-weight:800;
  }

  .app.app-tab-list .purchase-pagination{
    margin-top:14px;
  }

  .app.app-tab-list .purchase-item-detail-button,
  .app.app-tab-maint_list .link-btn{
    color:#1d4ed8;
    font-weight:850;
  }

  /* 카드형 목록은 외곽선·상태·액션을 같은 리듬으로 맞춥니다. */
  .app.app-tab-list .mobile-purchase-card,
  .app.app-tab-card_list .mobile-list-card,
  .app.app-tab-maint_list .mobile-list-card,
  .app.app-tab-trash_bin .mobile-list-card,
  .app.app-tab-activity_logs .mobile-list-card,
  .app.app-tab-permits .permit-card,
  .app.app-tab-vendor_accounts .vendor-account-card,
  .app.app-tab-bulk_transfer .bulk-transfer-card,
  .app.app-tab-receipt_photos .receipt-clean-card,
  .app.app-tab-maintenance_photos .receipt-clean-card{
    border-color:var(--erp-list-line);
    border-radius:15px;
    box-shadow:0 6px 18px rgba(15,23,42,.045);
  }

  .app.app-tab-list .mobile-purchase-card-head,
  .app.app-tab-card_list .mobile-list-top,
  .app.app-tab-maint_list .mobile-list-top,
  .app.app-tab-trash_bin .mobile-list-top,
  .app.app-tab-activity_logs .mobile-list-top{
    padding-bottom:10px;
    border-bottom:1px solid #edf1f5;
  }

  .app.app-tab-list .mobile-purchase-card-head strong,
  .app.app-tab-card_list .mobile-list-top b,
  .app.app-tab-maint_list .mobile-list-top b,
  .app.app-tab-trash_bin .mobile-list-top b,
  .app.app-tab-activity_logs .mobile-list-top b{
    color:var(--erp-list-ink);
    font-size:15px;
    font-weight:950;
  }

  .app.app-tab-list .mobile-purchase-card-row{
    padding:8px 0;
    font-size:12px;
  }

  .app.app-tab-list .mobile-purchase-card-row b{
    color:#1d4ed8;
    font-size:13px;
  }

  .app.app-tab-vendor_accounts .vendor-account-card,
  .app.app-tab-bulk_transfer .bulk-transfer-card{
    background:#fff;
  }

  .app.app-tab-vendor_accounts .vendor-account-title,
  .app.app-tab-bulk_transfer .bulk-card-main{
    padding-bottom:11px;
    border-bottom:1px solid #edf1f5;
  }

  .app.app-tab-receipt_photos .receipt-clean-card,
  .app.app-tab-maintenance_photos .receipt-clean-card{
    box-shadow:0 6px 18px rgba(15,23,42,.04);
  }

  .app.app-tab-receipt_photos .receipt-list-head,
  .app.app-tab-maintenance_photos .receipt-list-head{
    margin-top:20px;
    padding-top:18px;
    border-top:1px solid var(--erp-list-line);
  }

  .app.app-tab-trash_bin .scroll-table,
  .app.app-tab-activity_logs .scroll-table{
    max-height:calc(100vh - 405px);
  }

  .app.app-tab-trash_bin .scroll-table td,
  .app.app-tab-activity_logs .scroll-table td{
    font-size:12px;
  }

  /* 상세 모달의 표도 목록 표와 같은 밀도로 보이게 합니다. */
  .app .purchase-detail-modal .scroll-table,
  .app .wide-modal .scroll-table{
    border-radius:12px;
    border-color:var(--erp-list-line);
  }
  .app .purchase-detail-modal th,
  .app .wide-modal th{
    background:#eef4fa;
    color:#40516a;
    text-align:center;
  }
  .app .purchase-detail-modal td,
  .app .wide-modal td{
    text-align:center;
    vertical-align:middle;
  }
}

@media (max-width:900px){
  /* 모바일은 페이지 여백을 줄이고, 제목→필터→목록 순서를 또렷하게 합니다. */
  .app.app-tab-list>.lookup-page,
  .app.app-tab-status>.card,
  .app.app-tab-card_list>.lookup-page,
  .app.app-tab-card_stats>.card,
  .app.app-tab-maint_list>.lookup-page,
  .app.app-tab-maint_stats>.card,
  .app.app-tab-permits>.permit-page,
  .app.app-tab-receipt_photos>.receipt-photo-page,
  .app.app-tab-maintenance_photos>.receipt-photo-page,
  .app.app-tab-vendor_accounts>.vendor-account-page,
  .app.app-tab-bulk_transfer>.bulk-transfer-page,
  .app.app-tab-trash_bin>.trash-page,
  .app.app-tab-activity_logs>.activity-log-page{
    padding:15px !important;
    border-color:var(--erp-list-line);
    border-radius:16px !important;
  }

  .app.app-tab-list>.lookup-page>.between:first-child,
  .app.app-tab-status>.card>.between:first-child,
  .app.app-tab-card_list>.lookup-page>.between:first-child,
  .app.app-tab-card_stats>.card>.between:first-child,
  .app.app-tab-maint_list>.lookup-page>.between:first-child,
  .app.app-tab-maint_stats>.card>.between:first-child{
    gap:9px !important;
    margin-bottom:14px !important;
    padding-bottom:13px !important;
    border-bottom:1px solid var(--erp-list-line);
  }

  .app.app-tab-list>.lookup-page>.between:first-child h2,
  .app.app-tab-status>.card>.between:first-child h2,
  .app.app-tab-card_list>.lookup-page>.between:first-child h2,
  .app.app-tab-card_stats>.card>.between:first-child h2,
  .app.app-tab-maint_list>.lookup-page>.between:first-child h2,
  .app.app-tab-maint_stats>.card>.between:first-child h2{
    margin:0 !important;
    color:var(--erp-list-ink);
    font-size:22px !important;
  }

  .app.app-tab-list>.lookup-page>.grid5,
  .app.app-tab-status>.card>.grid5,
  .app.app-tab-card_list>.lookup-page>.grid5,
  .app.app-tab-card_stats>.card>.grid5,
  .app.app-tab-maint_stats>.card>.grid5,
  .app.app-tab-maint_list .maint-filter,
  .app.app-tab-permits>.permit-page>.grid5,
  .app.app-tab-permits>.permit-page>.grid3,
  .app.app-tab-trash_bin>.trash-page>.grid3,
  .app.app-tab-activity_logs>.activity-log-page>.grid3{
    gap:9px !important;
    margin-bottom:13px !important;
    padding:11px !important;
    border-color:var(--erp-list-line);
    border-radius:13px;
    background:var(--erp-list-soft);
  }

  .app.app-tab-list>.lookup-page>.grid5 .field,
  .app.app-tab-status>.card>.grid5 .field,
  .app.app-tab-card_list>.lookup-page>.grid5 .field,
  .app.app-tab-card_stats>.card>.grid5 .field,
  .app.app-tab-maint_stats>.card>.grid5 .field,
  .app.app-tab-maint_list .maint-filter .field,
  .app.app-tab-permits>.permit-page>.grid5 .field,
  .app.app-tab-permits>.permit-page>.grid3 .field,
  .app.app-tab-trash_bin>.trash-page>.grid3 .field,
  .app.app-tab-activity_logs>.activity-log-page>.grid3 .field{
    margin:0 !important;
  }

  .app.app-tab-status>.card>h3,
  .app.app-tab-card_stats>.card>h3,
  .app.app-tab-maint_stats>.card>h3{
    margin:19px 0 9px !important;
    padding-bottom:8px;
    border-bottom:1px solid #edf1f5;
    font-size:16px !important;
  }

  .app.app-tab-status>.card>.status-cards,
  .app.app-tab-card_list>.lookup-page>.status-cards,
  .app.app-tab-card_stats>.card>.status-cards,
  .app.app-tab-maint_stats>.card>.status-cards{
    grid-template-columns:repeat(2,minmax(0,1fr)) !important;
    gap:8px !important;
    margin:0 0 16px !important;
  }

  .app.app-tab-status>.card>.status-cards>div,
  .app.app-tab-card_list>.lookup-page>.status-cards>div,
  .app.app-tab-card_stats>.card>.status-cards>div,
  .app.app-tab-maint_stats>.card>.status-cards>div{
    min-height:76px !important;
    padding:11px !important;
    border-radius:13px !important;
  }

  .app.app-tab-status>.card>.status-cards span,
  .app.app-tab-card_list>.lookup-page>.status-cards span,
  .app.app-tab-card_stats>.card>.status-cards span,
  .app.app-tab-maint_stats>.card>.status-cards span{
    margin-bottom:5px !important;
    font-size:10px !important;
  }

  .app.app-tab-status>.card>.status-cards b,
  .app.app-tab-card_list>.lookup-page>.status-cards b,
  .app.app-tab-card_stats>.card>.status-cards b,
  .app.app-tab-maint_stats>.card>.status-cards b{
    color:#1d4ed8 !important;
    font-size:17px !important;
  }

  .app.app-tab-list .mobile-purchase-cards,
  .app.app-tab-card_list .mobile-card-list,
  .app.app-tab-maint_list .mobile-card-list,
  .app.app-tab-trash_bin .mobile-card-list,
  .app.app-tab-activity_logs .mobile-card-list{
    gap:9px !important;
    margin-top:10px !important;
  }

  .app.app-tab-list .mobile-purchase-card,
  .app.app-tab-card_list .mobile-list-card,
  .app.app-tab-maint_list .mobile-list-card,
  .app.app-tab-trash_bin .mobile-list-card,
  .app.app-tab-activity_logs .mobile-list-card{
    padding:13px !important;
    border-radius:14px !important;
    box-shadow:0 5px 15px rgba(15,23,42,.04) !important;
  }

  .app.app-tab-list .mobile-purchase-card-actions,
  .app.app-tab-card_list .mobile-card-actions,
  .app.app-tab-maint_list .mobile-card-actions,
  .app.app-tab-trash_bin .mobile-list-actions{
    gap:7px !important;
    margin-top:10px !important;
  }

  .app.app-tab-list .mobile-purchase-card-actions button,
  .app.app-tab-card_list .mobile-card-actions button,
  .app.app-tab-maint_list .mobile-card-actions button,
  .app.app-tab-trash_bin .mobile-list-actions button{
    min-height:36px !important;
    border-radius:10px !important;
    font-size:12px !important;
  }

  .app.app-tab-list .purchase-page-summary{
    margin:0 0 8px;
    font-size:11px;
  }

  .app.app-tab-vendor_accounts .vendor-account-card,
  .app.app-tab-bulk_transfer .bulk-transfer-card,
  .app.app-tab-permits .permit-card,
  .app.app-tab-receipt_photos .receipt-clean-card,
  .app.app-tab-maintenance_photos .receipt-clean-card{
    border-radius:14px;
    box-shadow:0 5px 15px rgba(15,23,42,.04);
  }

  .app.app-tab-vendor_accounts .vendor-account-title,
  .app.app-tab-bulk_transfer .bulk-card-main{
    padding-bottom:9px;
  }

  .app.app-tab-trash_bin .scroll-table,
  .app.app-tab-activity_logs .scroll-table{
    max-height:none;
    overflow-x:auto !important;
  }

  .app.app-tab-trash_bin .scroll-table td,
  .app.app-tab-activity_logs .scroll-table td{
    font-size:11px !important;
  }

  .app .purchase-detail-modal,
  .app .wide-modal{
    width:calc(100vw - 24px);
    max-width:none;
    padding:15px;
    border-radius:17px;
  }

  .app .purchase-detail-modal .scroll-table,
  .app .wide-modal .scroll-table{
    overflow-x:auto !important;
  }

  .app .purchase-detail-modal table,
  .app .wide-modal table{
    min-width:640px;
  }
}

@media (max-width:390px){
  .app.app-tab-status>.card>.status-cards,
  .app.app-tab-card_list>.lookup-page>.status-cards,
  .app.app-tab-card_stats>.card>.status-cards,
  .app.app-tab-maint_stats>.card>.status-cards{
    grid-template-columns:1fr !important;
  }
}
'''

css_start = app.find("const css = `")
if css_start < 0:
    raise RuntimeError("기존 앱 CSS 시작점을 찾지 못했습니다.")
css_end = app.find("\n`;", css_start)
if css_end < 0:
    raise RuntimeError("기존 앱 CSS 종료점을 찾지 못했습니다.")

app = app[:css_end] + f"\n{CSS}" + app[css_end:]
APP_PATH.write_text(app, encoding="utf-8")
print("ERP 목록 공통 디자인 패치를 적용했습니다.")
