// Excel needs the byte order mark to read UTF-8 names and accents correctly.
const BYTE_ORDER_MARK = "﻿";

// Hands CSV text to the browser as a file download.
export const saveCsv = (text: string, fileName: string): void => {
  const url = URL.createObjectURL(
    new Blob([BYTE_ORDER_MARK, text], { type: "text/csv;charset=utf-8" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
