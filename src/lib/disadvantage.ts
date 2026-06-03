/**
 * ประเภทความด้อยโอกาสตามแบบ พฐ.4 ของ สพฐ.
 * Single source — ใช้ร่วมระหว่างฟอร์ม StudentModal และ Excel template
 *
 * เรียงตามที่พบบ่อยในระบบโรงเรียน เพื่อให้ครูหาง่ายใน dropdown
 */
export const DISADVANTAGE_OPTIONS = [
  'เด็กยากจน',
  'เด็กถูกทอดทิ้ง/กำพร้า',
  'เด็กชนกลุ่มน้อย',
  'เด็กที่ถูกทำร้ายทารุณ',
  'เด็กเร่ร่อน',
  'เด็กที่ได้รับผลกระทบจากเอดส์',
  'เด็กที่มีปัญหาเกี่ยวกับยาเสพติด',
  'เด็กถูกบังคับให้ขายแรงงาน',
  'เด็กในสถานพินิจและคุ้มครองเยาวชน',
  'เด็กที่อยู่ในธุรกิจทางเพศ',
] as const

export type DisadvantageOption = typeof DISADVANTAGE_OPTIONS[number]

/** เช็คว่าค่าตรงกับ predefined options ไหม — ใช้ตัดสินว่าควร fall เข้าโหมด "อื่นๆ" หรือไม่ */
export function isPredefinedDisadvantage(value: string | null | undefined): boolean {
  if (!value) return false
  return (DISADVANTAGE_OPTIONS as readonly string[]).includes(value)
}
