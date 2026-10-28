// Client-side export: CSV download and "PDF" via the browser's print dialog (Save as PDF).
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const html = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function downloadCSV(name, headers, rows) {
  const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function printPDF(title, headers, rows) {
  const w = window.open("", "_blank");
  if (!w) return false; // popup blocked
  w.document.write(`<!doctype html><title>${html(title)}</title><style>
    body{font:12px/1.4 Segoe UI,Arial,sans-serif;margin:24px;color:#172b4d}h1{font-size:18px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd;padding:5px 7px;text-align:left}
    th{background:#eef1f6}tr:nth-child(even) td{background:#fafbfc}</style>
    <h1>${html(title)}</h1><p>${rows.length} rows - ${new Date().toLocaleString()}</p>
    <table><thead><tr>${headers.map((h) => `<th>${html(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${html(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
