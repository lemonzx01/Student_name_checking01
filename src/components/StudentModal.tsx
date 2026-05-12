'use client'

import { useEffect, useMemo, useState } from 'react'
import { Camera, Trash2, Upload, User, UserPlus, X } from 'lucide-react'
import { Classroom, Student, StudentFormInput } from '@/types'
import {
  createStudentRecord,
  deleteStudentPhoto,
  getClassrooms,
  saveStudentPhoto,
  updateStudentRecord,
} from '@/lib/client-data'
import CalendarPicker from '@/components/CalendarPicker'
import CustomSelect from '@/components/CustomSelect'
import StudentAvatar from '@/components/StudentAvatar'
import { invalidatePhotoCache } from '@/lib/hooks/usePhotoUrl'
import { useDialog } from '@/lib/hooks/useConfirm'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  student?: Student | null
  classroomId?: number | null
}

function getInitialFormData(classroomId?: number | null): StudentFormInput {
  return {
    student_id: '',
    national_id: '',
    student_number: '',
    title: '',
    first_name: '',
    last_name: '',
    classroom_id: classroomId || 0,
    classroom_label: '',
    gender: '',
    birth_date: '',
    age_years: '',
    weight_kg: null,
    height_cm: null,
    house_no: '',
    village_no: '',
    guardian_title: '',
    guardian_first_name: '',
    guardian_last_name: '',
    guardian_occupation: '',
    guardian_relation: '',
    guardian_phone: '',
    father_title: '',
    father_first_name: '',
    father_last_name: '',
    father_occupation: '',
    mother_title: '',
    mother_first_name: '',
    mother_last_name: '',
    mother_occupation: '',
    disadvantage: '',
    source_payload: null,
    photo_path: null,
  }
}

/**
 * Resize + compress รูปด้วย Canvas API ก่อน upload
 * ลดเป็น max 400x400 + JPEG quality 0.8
 */
async function resizeImage(file: File): Promise<{ blob: Blob; ext: string }> {
  const maxSize = 400
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Image load failed'))
      i.src = url
    })

    let { width, height } = img
    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context unavailable')
    // วาดพื้นขาวก่อน — กันรูป png โปร่งใสกลายเป็นดำตอน save jpeg
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.8)
    )
    if (!blob) throw new Error('Canvas toBlob failed')
    return { blob, ext: 'jpg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[var(--text-soft)]">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'input'

export default function StudentModal({
  isOpen,
  onClose,
  onSuccess,
  student,
  classroomId,
}: Props) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [formData, setFormData] = useState<StudentFormInput>(getInitialFormData(classroomId))
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const { alert } = useDialog()

  const activeClassroomName = useMemo(
    () => classrooms.find((item) => item.id === formData.classroom_id)?.name || '',
    [classrooms, formData.classroom_id]
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    getClassrooms().then(setClassrooms)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (student) {
      setFormData({
        student_id: student.student_id,
        national_id: student.national_id ?? '',
        student_number: student.student_number ?? '',
        title: student.title ?? '',
        first_name: student.first_name,
        last_name: student.last_name,
        classroom_id: student.classroom_id,
        classroom_label: student.classroom_label ?? '',
        gender: student.gender,
        birth_date: student.birth_date ?? '',
        age_years: student.age_years ?? '',
        weight_kg: student.weight_kg ?? null,
        height_cm: student.height_cm ?? null,
        house_no: student.house_no ?? '',
        village_no: student.village_no ?? '',
        guardian_title: student.guardian_title ?? '',
        guardian_first_name: student.guardian_first_name ?? '',
        guardian_last_name: student.guardian_last_name ?? '',
        guardian_occupation: student.guardian_occupation ?? '',
        guardian_relation: student.guardian_relation ?? '',
        guardian_phone: student.guardian_phone ?? '',
        father_title: student.father_title ?? '',
        father_first_name: student.father_first_name ?? '',
        father_last_name: student.father_last_name ?? '',
        father_occupation: student.father_occupation ?? '',
        mother_title: student.mother_title ?? '',
        mother_first_name: student.mother_first_name ?? '',
        mother_last_name: student.mother_last_name ?? '',
        mother_occupation: student.mother_occupation ?? '',
        disadvantage: student.disadvantage ?? '',
        source_payload: student.source_payload ?? null,
        photo_path: student.photo_path ?? null,
      })
      return
    }

    setFormData(getInitialFormData(classroomId))
  }, [classroomId, isOpen, student])

  if (!isOpen) {
    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload: StudentFormInput = {
      ...formData,
      classroom_label: activeClassroomName,
      student_number: formData.student_number || formData.student_id,
      gender: formData.gender || (formData.title?.includes('หญิง') ? 'หญิง' : formData.title?.includes('ชาย') ? 'ชาย' : ''),
    }

    setSaving(true)

    try {
      if (student) {
        await updateStudentRecord(student.id, payload)
      } else {
        await createStudentRecord(payload)
      }

      onSuccess()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function updateField(field: keyof StudentFormInput, value: any) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // reset เพื่อให้ select ไฟล์ซ้ำได้
    if (!file) return

    if (!student) {
      await alert({
        title: 'บันทึกข้อมูลนักเรียนก่อน',
        message: 'กรุณากดบันทึกข้อมูลนักเรียนก่อน แล้วค่อยอัปโหลดรูปประจำตัว',
        variant: 'warning',
      })
      return
    }

    setUploadingPhoto(true)
    try {
      const { blob, ext } = await resizeImage(file)
      const result = await saveStudentPhoto(student.id, blob, ext)
      if (!result.success || !result.photo_path) {
        throw new Error(result.error || 'อัปโหลดไม่สำเร็จ')
      }
      // invalidate cache เก่า + ตั้งค่า photo_path ใหม่ (cache buster suffix)
      invalidatePhotoCache(formData.photo_path)
      invalidatePhotoCache(result.photo_path)
      setFormData((prev) => ({ ...prev, photo_path: result.photo_path! }))
    } catch (err) {
      console.error('[StudentModal] upload photo failed:', err)
      await alert({
        title: 'อัปโหลดรูปไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handlePhotoDelete() {
    if (!student || !formData.photo_path) return
    setUploadingPhoto(true)
    try {
      const result = await deleteStudentPhoto(student.id)
      if (!result.success) {
        throw new Error(result.error || 'ลบไม่สำเร็จ')
      }
      invalidatePhotoCache(formData.photo_path)
      setFormData((prev) => ({ ...prev, photo_path: null }))
    } catch (err) {
      console.error('[StudentModal] delete photo failed:', err)
      await alert({
        title: 'ลบรูปไม่สำเร็จ',
        message: err instanceof Error ? err.message : 'ลองใหม่อีกครั้ง',
        variant: 'error',
      })
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:pl-[296px]">
      <div className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-content relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[var(--radius-xl)] bg-[var(--surface)] shadow-2xl">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface)] px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)]"
                style={
                  student
                    ? { background: 'var(--primary-ghost)', color: 'var(--primary-strong)' }
                    : { background: 'var(--success-soft)', color: 'var(--success-strong)' }
                }
              >
                {student ? <User size={20} /> : <UserPlus size={20} />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text)]">
                  {student ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียน'}
                </h2>
                <p className="text-xs text-[var(--muted)]">กรอกข้อมูลหลักให้ครบ</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-press flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Section: รูปประจำตัว */}
          <div className="mb-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--info)]" />
              รูปประจำตัว
            </h3>
            <div className="flex items-center gap-5 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-soft)] p-4">
              <StudentAvatar
                photoPath={formData.photo_path}
                name={`${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'นักเรียน'}
                size={120}
                className="border-4 border-[var(--surface)] shadow-[var(--shadow-sm)]"
              />
              <div className="flex-1 space-y-2">
                {!student ? (
                  <p className="text-xs text-[var(--muted)]">
                    บันทึกข้อมูลนักเรียนก่อน แล้วเปิดแก้ไขเพื่ออัปโหลดรูป
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-[var(--muted)]">
                      รูปจะถูกย่อให้ไม่เกิน 400×400 อัตโนมัติ — ไฟล์เล็ก โหลดเร็ว
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <label
                        className={`btn btn-primary btn-sm btn-press cursor-pointer ${
                          uploadingPhoto ? 'pointer-events-none opacity-50' : ''
                        }`}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          className="hidden"
                        />
                        {formData.photo_path ? <Camera size={14} /> : <Upload size={14} />}
                        {uploadingPhoto
                          ? 'กำลังอัปโหลด...'
                          : formData.photo_path
                            ? 'เปลี่ยนรูป'
                            : 'อัปโหลดรูป'}
                      </label>
                      {formData.photo_path && (
                        <button
                          type="button"
                          onClick={handlePhotoDelete}
                          disabled={uploadingPhoto}
                          className="btn btn-danger-ghost btn-sm btn-press"
                        >
                          <Trash2 size={14} />
                          ลบรูป
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section: รหัสและห้อง */}
          <div className="mb-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
              รหัสและห้องเรียน
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormField label="รหัสหลัก">
                <input
                  value={formData.student_id}
                  onChange={(e) => updateField('student_id', e.target.value)}
                  className={inputClass}
                  required
                />
              </FormField>
              <FormField label="เลขที่/รหัสนักเรียน">
                <input
                  value={formData.student_number ?? ''}
                  onChange={(e) => updateField('student_number', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="เลข 13 หลัก">
                <input
                  value={formData.national_id ?? ''}
                  onChange={(e) => updateField('national_id', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="ห้องเรียน">
                <CustomSelect
                  value={formData.classroom_id}
                  onChange={(v) => updateField('classroom_id', Number(v))}
                  options={[
                    { value: 0, label: 'เลือกห้องเรียน' },
                    ...classrooms.map((item) => ({ value: item.id, label: item.name })),
                  ]}
                  placeholder="เลือกห้องเรียน"
                />
              </FormField>
            </div>
          </div>

          {/* Section: ข้อมูลส่วนตัว */}
          <div className="mb-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              ข้อมูลส่วนตัว
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormField label="คำนำหน้า">
                <CustomSelect
                  value={formData.title ?? ''}
                  onChange={(v) => updateField('title', String(v))}
                  options={[
                    { value: '', label: 'เลือกคำนำหน้า' },
                    { value: 'เด็กชาย', label: 'เด็กชาย' },
                    { value: 'เด็กหญิง', label: 'เด็กหญิง' },
                    { value: 'นาย', label: 'นาย' },
                    { value: 'นางสาว', label: 'นางสาว' },
                  ]}
                  placeholder="เลือกคำนำหน้า"
                />
              </FormField>
              <FormField label="ชื่อ">
                <input
                  value={formData.first_name}
                  onChange={(e) => updateField('first_name', e.target.value)}
                  className={inputClass}
                  required
                />
              </FormField>
              <FormField label="นามสกุล">
                <input
                  value={formData.last_name}
                  onChange={(e) => updateField('last_name', e.target.value)}
                  className={inputClass}
                  required
                />
              </FormField>
              <FormField label="เพศ">
                <CustomSelect
                  value={formData.gender}
                  onChange={(v) => updateField('gender', String(v))}
                  options={[
                    { value: '', label: 'ระบุอัตโนมัติ' },
                    { value: 'ชาย', label: 'ชาย' },
                    { value: 'หญิง', label: 'หญิง' },
                  ]}
                  placeholder="ระบุอัตโนมัติ"
                />
              </FormField>
            </div>
          </div>

          {/* Section: ข้อมูลเพิ่มเติม */}
          <div className="mb-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              ข้อมูลเพิ่มเติม
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <CalendarPicker
                value={formData.birth_date ?? ''}
                onChange={(value) => updateField('birth_date', value)}
                label="วันเกิด"
              />
              <FormField label="อายุ (ปี)">
                <input
                  value={formData.age_years ?? ''}
                  onChange={(e) => updateField('age_years', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="น้ำหนัก (กก.)">
                <input
                  type="number"
                  step="0.1"
                  value={formData.weight_kg ?? ''}
                  onChange={(e) => updateField('weight_kg', e.target.value === '' ? null : Number(e.target.value))}
                  className={inputClass}
                />
              </FormField>
              <FormField label="ส่วนสูง (ซม.)">
                <input
                  type="number"
                  step="0.1"
                  value={formData.height_cm ?? ''}
                  onChange={(e) => updateField('height_cm', e.target.value === '' ? null : Number(e.target.value))}
                  className={inputClass}
                />
              </FormField>
              <FormField label="บ้านเลขที่">
                <input
                  value={formData.house_no ?? ''}
                  onChange={(e) => updateField('house_no', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="หมู่">
                <input
                  value={formData.village_no ?? ''}
                  onChange={(e) => updateField('village_no', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="ความด้อยโอกาส">
                <input
                  value={formData.disadvantage ?? ''}
                  onChange={(e) => updateField('disadvantage', e.target.value)}
                  className={inputClass}
                />
              </FormField>
            </div>
          </div>

          {/* Section: ผู้ปกครอง */}
          <div className="mb-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--info)]" />
              ผู้ปกครอง
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormField label="คำนำหน้าผู้ปกครอง">
                <CustomSelect
                  value={formData.guardian_title ?? ''}
                  onChange={(v) => updateField('guardian_title', String(v))}
                  options={[
                    { value: '', label: 'เลือก' },
                    { value: 'นาย', label: 'นาย' },
                    { value: 'นาง', label: 'นาง' },
                    { value: 'นางสาว', label: 'นางสาว' },
                  ]}
                  placeholder="เลือก"
                />
              </FormField>
              <FormField label="ชื่อผู้ปกครอง">
                <input
                  value={formData.guardian_first_name ?? ''}
                  onChange={(e) => updateField('guardian_first_name', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="นามสกุลผู้ปกครอง">
                <input
                  value={formData.guardian_last_name ?? ''}
                  onChange={(e) => updateField('guardian_last_name', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="ความเกี่ยวข้อง">
                <CustomSelect
                  value={formData.guardian_relation ?? ''}
                  onChange={(v) => updateField('guardian_relation', String(v))}
                  options={[
                    { value: '', label: 'เลือก' },
                    { value: 'บิดา', label: 'บิดา' },
                    { value: 'มารดา', label: 'มารดา' },
                    { value: 'ปู่', label: 'ปู่' },
                    { value: 'ย่า', label: 'ย่า' },
                    { value: 'ตา', label: 'ตา' },
                    { value: 'ยาย', label: 'ยาย' },
                    { value: 'ลุง', label: 'ลุง' },
                    { value: 'ป้า', label: 'ป้า' },
                    { value: 'น้า', label: 'น้า' },
                    { value: 'อา', label: 'อา' },
                    { value: 'อื่นๆ', label: 'อื่นๆ' },
                  ]}
                  placeholder="เลือก"
                />
              </FormField>
              <FormField label="อาชีพผู้ปกครอง">
                <input
                  value={formData.guardian_occupation ?? ''}
                  onChange={(e) => updateField('guardian_occupation', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="เบอร์โทรผู้ปกครอง">
                <input
                  type="tel"
                  inputMode="tel"
                  value={formData.guardian_phone ?? ''}
                  onChange={(e) => updateField('guardian_phone', e.target.value)}
                  placeholder="08x-xxx-xxxx"
                  className={inputClass}
                />
              </FormField>
            </div>
          </div>

          {/* Section: บิดา-มารดา */}
          <div className="mb-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
              บิดา
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormField label="คำนำหน้า">
                <CustomSelect
                  value={formData.father_title ?? ''}
                  onChange={(v) => updateField('father_title', String(v))}
                  options={[
                    { value: '', label: 'เลือก' },
                    { value: 'นาย', label: 'นาย' },
                  ]}
                  placeholder="เลือก"
                />
              </FormField>
              <FormField label="ชื่อบิดา">
                <input
                  value={formData.father_first_name ?? ''}
                  onChange={(e) => updateField('father_first_name', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="นามสกุลบิดา">
                <input
                  value={formData.father_last_name ?? ''}
                  onChange={(e) => updateField('father_last_name', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="อาชีพบิดา">
                <input
                  value={formData.father_occupation ?? ''}
                  onChange={(e) => updateField('father_occupation', e.target.value)}
                  className={inputClass}
                />
              </FormField>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
              มารดา
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormField label="คำนำหน้า">
                <CustomSelect
                  value={formData.mother_title ?? ''}
                  onChange={(v) => updateField('mother_title', String(v))}
                  options={[
                    { value: '', label: 'เลือก' },
                    { value: 'นาง', label: 'นาง' },
                    { value: 'นางสาว', label: 'นางสาว' },
                  ]}
                  placeholder="เลือก"
                />
              </FormField>
              <FormField label="ชื่อมารดา">
                <input
                  value={formData.mother_first_name ?? ''}
                  onChange={(e) => updateField('mother_first_name', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="นามสกุลมารดา">
                <input
                  value={formData.mother_last_name ?? ''}
                  onChange={(e) => updateField('mother_last_name', e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="อาชีพมารดา">
                <input
                  value={formData.mother_occupation ?? ''}
                  onChange={(e) => updateField('mother_occupation', e.target.value)}
                  className={inputClass}
                />
              </FormField>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-[var(--line)] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-press flex-1"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving || !formData.student_id || !formData.first_name || !formData.last_name || !formData.classroom_id}
              className="btn btn-primary btn-press flex-1"
            >
              {saving ? 'กำลังบันทึก...' : student ? 'บันทึกข้อมูล' : 'เพิ่มนักเรียน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
