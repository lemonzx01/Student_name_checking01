/**
 * Templates ข้อความสำหรับครูส่งให้ผู้ปกครอง (ภาษาไทย)
 * คืน string พร้อม copy/paste ใน LINE/SMS
 */

export interface MinimalStudent {
  title?: string | null
  first_name: string
  last_name: string
  classroom_name?: string | null
  classroom_label?: string | null
}

function fullName(student: MinimalStudent): string {
  return [student.title, student.first_name, student.last_name].filter(Boolean).join(' ')
}

function classroomDisplay(student: MinimalStudent): string {
  return student.classroom_name || student.classroom_label || ''
}

function formatThaiDate(iso: string): string {
  // YYYY-MM-DD → "12 เม.ย. 2568"
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ]
  return `${d} ${months[m - 1]} ${y + 543}`
}

/** ข้อความแจ้งขาดเรียน */
export function absentMessage(student: MinimalStudent, date: string, status = 'ขาดเรียน'): string {
  const name = fullName(student)
  const cls = classroomDisplay(student)
  const dateText = formatThaiDate(date)
  return [
    `เรียนผู้ปกครองนักเรียน ${name}${cls ? ` ห้อง ${cls}` : ''}`,
    `วันที่ ${dateText} นักเรียน${status}`,
    `กรุณาแจ้งสาเหตุกับคุณครูประจำชั้นด้วยครับ/ค่ะ`,
    `ขอบคุณค่ะ/ครับ`,
  ].join('\n')
}

/** ข้อความแจ้งคะแนนต่ำ */
export function lowGradeMessage(
  student: MinimalStudent,
  subject: string,
  score: number,
  fullScore = 100
): string {
  const name = fullName(student)
  return [
    `เรียนผู้ปกครองนักเรียน ${name}`,
    `คะแนนวิชา ${subject} = ${score}/${fullScore}`,
    `คุณครูต้องการความร่วมมือจากผู้ปกครองในการช่วยกระตุ้นการเรียนของบุตรหลานด้วย`,
    `หากสะดวกพูดคุย กรุณาตอบกลับเพื่อนัดเวลาด้วยครับ/ค่ะ`,
  ].join('\n')
}

/** ข้อความแจ้งการบ้าน */
export function homeworkMessage(
  student: MinimalStudent,
  homeworkDetail: string
): string {
  const name = fullName(student)
  return [
    `เรียนผู้ปกครองนักเรียน ${name}`,
    `แจ้งการบ้าน/งานที่ต้องทำ:`,
    homeworkDetail,
    `กรุณาช่วยกำกับให้บุตรหลานทำงานเสร็จด้วยครับ/ค่ะ`,
    `ขอบคุณค่ะ/ครับ`,
  ].join('\n')
}

/** ข้อความเชิญผู้ปกครองพบครู */
export function meetingRequestMessage(
  student: MinimalStudent,
  dateTimeText: string,
  reason = ''
): string {
  const name = fullName(student)
  return [
    `เรียนผู้ปกครองนักเรียน ${name}`,
    `คุณครูใคร่ขอเชิญผู้ปกครองมาพบที่โรงเรียน`,
    `วันเวลา: ${dateTimeText}`,
    reason ? `เรื่อง: ${reason}` : '',
    `หากไม่สะดวกในวันเวลาดังกล่าว กรุณาตอบกลับเพื่อนัดเวลาใหม่ด้วยครับ/ค่ะ`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** ข้อความแจ้งทั่วไป */
export function generalNoticeMessage(student: MinimalStudent, content: string): string {
  const name = fullName(student)
  return [
    `เรียนผู้ปกครองนักเรียน ${name}`,
    content,
    `ขอบคุณค่ะ/ครับ`,
  ].join('\n')
}

/** ข้อความแจ้งกิจกรรม */
export function activityMessage(
  student: MinimalStudent,
  activity: string,
  dateTimeText: string
): string {
  const name = fullName(student)
  return [
    `เรียนผู้ปกครองนักเรียน ${name}`,
    `แจ้งกิจกรรม: ${activity}`,
    `วันเวลา: ${dateTimeText}`,
    `กรุณาเตรียมตัวให้บุตรหลานล่วงหน้าด้วยครับ/ค่ะ`,
  ].join('\n')
}

/** LINE deep link — เปิดหน้าแชทใหม่ใน LINE */
export const LINE_OPEN_URL = 'https://line.me/R/nv/chat'
