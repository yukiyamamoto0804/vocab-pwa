const pad = (n: number) => String(n).padStart(2, '0')

/** 日時を「2026/11/23 14:05」の形にする（端末の時刻） */
export function formatDateTime(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${pad(d.getMinutes())}`
}
