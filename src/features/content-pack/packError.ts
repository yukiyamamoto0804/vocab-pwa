// 取り込みを中止する理由。どのファイルのどの項目が不正かを、画面にそのまま表示できる形で持つ。
export interface PackError {
  /** 例: 「items.json の 3 番目（id: 0003）の senses[0].example」 */
  where: string
  message: string
}
