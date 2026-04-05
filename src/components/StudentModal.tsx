'use client'

import { useEffect, useMemo, useState } from 'react'
import { User, UserPlus, X } from 'lucide-react'
import { Classroom, Student, StudentFormInput } from '@/types'
import { createStudentRecord, getClassrooms, updateStudentRecord } from '@/lib/client-data'
import CalendarPicker from '@/components/CalendarPicker'
import CustomSelect from '@/components/CustomSelect'

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
  }
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-0'

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="modal-overlay absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-content relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[var(--radius-lg)] bg-white shadow-2xl">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${student ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {student ? <User size={20} /> : <UserPlus size={20} />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {student ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียน'}
                </h2>
                <p className="text-xs text-[var(--muted)]">กรอกข้อมูลหลักให้ครบ</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-press flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Section: รหัสและห้อง */}
          <div className="mb-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
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
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              ข้อมูลส่วนตัว
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormField label="คำนำหน้า">
                <input
                  value={formData.title ?? ''}
                  onChange={(e) => updateField('title', e.target.value)}
                  className={inputClass}
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
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
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
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-[var(--line)] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="btn-press flex-1 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving || !formData.student_id || !formData.first_name || !formData.last_name || !formData.classroom_id}
              className="btn-press flex-1 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก...' : student ? 'บันทึกข้อมูล' : 'เพิ่มนักเรียน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
