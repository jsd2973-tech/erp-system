import type { ComponentType, ReactNode } from "react";

export type CardExportRow = Record<string, string | number>;

export type CardFieldProps = {
  label: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
};

export type CardDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

export type CardAttachmentGroupProps = {
  urls?: string[];
  onRemove?: (index: number) => void;
};

export type CardScrollTableProps = { children: ReactNode };

export type CardModuleUi = {
  Field: ComponentType<CardFieldProps>;
  DateInput: ComponentType<CardDateInputProps>;
  AttachmentGroup: ComponentType<CardAttachmentGroupProps>;
  ScrollTable: ComponentType<CardScrollTableProps>;
  money: (value: number | string | undefined) => string;
  downloadExcel: (fileName: string, rows: CardExportRow[]) => void;
  downloadPdf: (fileName: string, title: string, rows: CardExportRow[]) => void;
  todayText: () => string;
  withTotalRow: (rows: CardExportRow[], totalRow: CardExportRow) => CardExportRow[];
};
