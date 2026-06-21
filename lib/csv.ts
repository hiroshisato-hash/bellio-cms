// 最小限の CSV パーサ/ジェネレータ（RFC4180準拠・日本語/改行/引用符対応）

// CSV文字列を行×列の2次元配列にパース
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  // BOM除去
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ }  // エスケープされた引用符
        else inQuotes = false
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        row.push(field); field = ''
      } else if (c === '\n') {
        row.push(field); field = ''
        rows.push(row); row = []
      } else if (c === '\r') {
        // CRLF/CR を吸収（次が\nならスキップ）
        if (s[i + 1] === '\n') i++
        row.push(field); field = ''
        rows.push(row); row = []
      } else {
        field += c
      }
    }
  }
  // 末尾フィールド/行
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // 完全な空行を除去
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

// 1セルをCSVエスケープ
function escapeCell(v: string): string {
  if (/[",\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

// 2次元配列をCSV文字列に（先頭にBOMを付けてExcelで文字化けしないように）
export function toCsv(rows: string[][], bom = true): string {
  const body = rows.map(r => r.map(c => escapeCell(c ?? '')).join(',')).join('\r\n')
  return (bom ? '﻿' : '') + body
}
