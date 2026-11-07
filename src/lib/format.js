export const number = (value) =>
  value == null || !Number.isFinite(value)
    ? "N/D"
    : value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
export const money = (value, currency = "C$") =>
  value == null || !Number.isFinite(value)
    ? "N/D"
    : `${currency} ${number(value)}`;
export const percent = (value) =>
  value == null || !Number.isFinite(value) ? "N/D" : `${number(value * 100)}%`;
export const times = (value) =>
  value == null ? "N/D" : `${number(value)} veces`;
export const download = (name, text, type = "text/plain") => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
// Prevent spreadsheet programs from treating user labels as executable formulas.
export const csv = (name, rows) =>
  download(
    name,
    "\ufeff" +
      rows
        .map((row) =>
          row
            .map((value) => {
              const s = String(value ?? "");
              return (
                '"' +
                (/^[=+@\-]/.test(s) && typeof value !== "number"
                  ? "'" + s
                  : s
                ).replaceAll('"', '""') +
                '"'
              );
            })
            .join(","),
        )
        .join("\r\n"),
    "text/csv;charset=utf-8",
  );
