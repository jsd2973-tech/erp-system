import { Camera, RotateCcw, Save, Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import type { useCardModule } from "./useCardModule";
import type { CardModuleUi } from "./cardUiTypes";

type CardEntryModel = ReturnType<typeof useCardModule>["entry"];
type CardEntryUi = Pick<CardModuleUi, "Field" | "DateInput" | "AttachmentGroup">;

export function CardEntry({ model, ui }: { model: CardEntryModel; ui: CardEntryUi }) {
  const { Field, DateInput, AttachmentGroup } = ui;
  const {
    cardForm,
    editingCardUseId,
    cardSaving,
    cardUploading,
    cardOcrState,
    cardOcrMessage,
    todayKey,
    onDateChange,
    onUserNameChange,
    onPlaceChange,
    onAmountChange,
    onMemoChange,
    onAttachmentChange,
    onRemoveAttachment,
    onSave,
    onReset,
  } = model;

  return (
    <section className="card">
      <h2>{editingCardUseId ? "카드사용 수정" : "카드사용 등록"}</h2>

      <div className="grid5">
        <Field label="사용일자" required>
          <DateInput
            value={cardForm.date || todayKey()}
            onChange={onDateChange}
            placeholder="20260519 또는 260519"
            ariaLabel="사용일자 선택"
          />
        </Field>
        <Field label="담당자">
          <input value={cardForm.user_name} onChange={(event) => onUserNameChange(event.target.value)} placeholder="사용자/작업자" />
        </Field>
        <Field label="사용처" required>
          <input value={cardForm.place} onChange={(event) => onPlaceChange(event.target.value)} placeholder="상호/구매처" />
        </Field>
        <Field label="금액" required>
          <input className="right" inputMode="decimal" value={cardForm.amount} onChange={(event) => onAmountChange(event.target.value)} placeholder="0" />
        </Field>
        <Field label="메모">
          <input value={cardForm.memo} onChange={(event) => onMemoChange(event.target.value)} placeholder="구매내용 메모" />
        </Field>
      </div>

      <div className="between card-receipt-upload-area">
        <div className="card-receipt-upload-actions">
          <label className={`upload card-receipt-capture${cardUploading ? " upload-busy" : ""}`} aria-disabled={cardUploading}>
            <Camera size={16} /> 영수증 촬영
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={cardUploading}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onAttachmentChange(event)}
            />
          </label>
          <label className={`upload${cardUploading ? " upload-busy" : ""}`} aria-disabled={cardUploading}>
            <Upload size={16} /> 사진/파일 선택
            <input
              type="file"
              accept="image/*,application/pdf,audio/*,.mp3,.m4a,.wav,.webm,.ogg,.aac"
              multiple
              disabled={cardUploading}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onAttachmentChange(event)}
            />
          </label>
        </div>
        <div className={`card-ocr-status card-ocr-status-${cardOcrState}`} aria-live="polite">
          <strong>{cardOcrState === "analyzing" ? "영수증 분석 중..." : "영수증 OCR"}</strong>
          <span>{cardOcrMessage || "이미지 첨부 시 날짜·상호명·총합계를 자동 입력합니다."}</span>
        </div>
        <div className="receipt-preview">
          {(cardForm.image_urls || []).length ? (
            <AttachmentGroup urls={cardForm.image_urls || []} onRemove={onRemoveAttachment} />
          ) : (
            cardForm.image_url ? <a href={cardForm.image_url} target="_blank" rel="noreferrer">업로드한 영수증 보기</a> : <span>영수증 미첨부</span>
          )}
        </div>
      </div>

      <div className="actions right-actions entry-actions">
        <button className="primary" disabled={cardSaving || cardUploading} onClick={onSave}>
          <Save size={16} /> {cardOcrState === "analyzing" ? "영수증 분석 중..." : cardUploading ? "업로드 중..." : cardSaving ? "저장 중..." : editingCardUseId ? "수정 저장" : "저장"}
        </button>
        <button disabled={cardSaving || cardUploading} onClick={onReset}><RotateCcw size={16} /> 초기화</button>
      </div>
      <p className="draft-help-text">작성 중인 카드사용 내용은 자동 임시저장됩니다. 새로고침하거나 메뉴를 이동해도 다시 카드사용에 들어오면 복원됩니다.</p>
    </section>
  );
}
