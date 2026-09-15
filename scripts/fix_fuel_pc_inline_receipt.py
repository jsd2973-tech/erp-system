from pathlib import Path

source = Path('src/features/fuel/FuelManagement.tsx')
s = source.read_text()


def replace_once(old: str, new: str, label: str):
    global s
    if new in s:
        return
    if old not in s:
        raise SystemExit(f'{label} anchor not found')
    s = s.replace(old, new, 1)

replace_once(
    'import { useEffect, useMemo, useRef, useState } from "react";',
    'import { Fragment, useEffect, useMemo, useRef, useState } from "react";',
    'Fragment import',
)

receipt_button_old = '<button className={`fuel-receipt-state ${record.receipt_path ? "is-attached" : ""}`} type="button" onClick={() => setReceiptTarget({ ...record })}><Paperclip size={13} /> {record.receipt_path ? "첨부됨" : "미첨부"}</button>'
receipt_button_new = '<button className={`fuel-receipt-state ${record.receipt_path ? "is-attached" : ""}`} type="button" disabled={receiptBusy} onClick={() => void toggleMobileReceipt(record)}><Paperclip size={13} /> {record.receipt_path ? (mobileReceiptPreview?.id === record.id ? "영수증 닫기" : "첨부됨") : "미첨부"}</button>'
if receipt_button_new not in s:
    count = s.count(receipt_button_old)
    if count < 1:
        raise SystemExit('desktop receipt status button not found')
    s = s.replace(receipt_button_old, receipt_button_new)

# Older/detail markup can still be an icon-only button depending on the source shape.
detail_icon_old = '<button className="fuel-icon-button" type="button" title={record.receipt_path ? "영수증 보기/교체" : "영수증 첨부"} onClick={() => setReceiptTarget({ ...record })}><Paperclip size={15} /></button>'
detail_icon_new = '<button className={`fuel-receipt-state ${record.receipt_path ? "is-attached" : ""}`} type="button" disabled={receiptBusy} onClick={() => void toggleMobileReceipt(record)}><Paperclip size={13} /> {record.receipt_path ? (mobileReceiptPreview?.id === record.id ? "영수증 닫기" : "첨부됨") : "미첨부"}</button>'
if detail_icon_old in s:
    s = s.replace(detail_icon_old, detail_icon_new, 1)

replace_once(
    'filtered.map((record) => <tr key={record.id}>',
    'filtered.map((record) => <Fragment key={record.id}><tr>',
    'main desktop row fragment start',
)

main_row_end = '''</div></td>\n          </tr>)}</tbody>'''
main_preview = '''</div></td>\n          </tr>{mobileReceiptPreview?.id === record.id && <tr className="fuel-desktop-receipt-row"><td colSpan={13}><div className="fuel-desktop-receipt-inline">{mobileReceiptPreview.mime === "application/pdf" || /\\.pdf$/i.test(mobileReceiptPreview.name) ? <iframe src={mobileReceiptPreview.url} title="영수증 PDF 미리보기" /> : <img src={mobileReceiptPreview.url} alt={mobileReceiptPreview.name} />}</div></td></tr>}</Fragment>)}</tbody>'''
replace_once(main_row_end, main_preview, 'main desktop inline receipt')

replace_once(
    'detailRows.map((record) => <tr key={record.id}>',
    'detailRows.map((record) => <Fragment key={record.id}><tr>',
    'detail desktop row fragment start',
)

detail_row_end = '''</button></td></tr>)}</tbody>'''
detail_preview = '''</button></td></tr>{mobileReceiptPreview?.id === record.id && <tr className="fuel-desktop-receipt-row"><td colSpan={10}><div className="fuel-desktop-receipt-inline">{mobileReceiptPreview.mime === "application/pdf" || /\\.pdf$/i.test(mobileReceiptPreview.name) ? <iframe src={mobileReceiptPreview.url} title="영수증 PDF 미리보기" /> : <img src={mobileReceiptPreview.url} alt={mobileReceiptPreview.name} />}</div></td></tr>}</Fragment>)}</tbody>'''
replace_once(detail_row_end, detail_preview, 'detail desktop inline receipt')

source.write_text(s)

css_path = Path('src/features/fuel/fuelManagement.css')
css = css_path.read_text()
css_add = '\n.fuel-desktop-receipt-row td{padding:0!important;background:#f8fafc}.fuel-desktop-receipt-inline{margin:10px 14px 14px;border:1px solid #dbe5ee;border-radius:12px;background:#fff;overflow:hidden;display:grid;place-items:center;min-height:260px}.fuel-desktop-receipt-inline img{display:block;max-width:100%;max-height:72vh;object-fit:contain}.fuel-desktop-receipt-inline iframe{display:block;width:100%;height:min(72vh,780px);border:0;background:#fff}\n'
if '.fuel-desktop-receipt-inline{' not in css:
    css += css_add
    css_path.write_text(css)
