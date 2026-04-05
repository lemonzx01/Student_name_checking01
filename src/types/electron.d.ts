import type { ImportStudentsResult } from '@/types'

export {}

declare global {
  interface Window {
    electronAPI?: {
      getClassrooms: () => Promise<any[]>
      createClassroom: (data: { name: string; level: string; academic_year: string }) => Promise<any>
      updateClassroom: (data: { id: number; name: string; level: string; academic_year: string }) => Promise<{ success: boolean }>
      deleteClassroom: (id: number) => Promise<{ success: boolean }>
      getStudents: (classroomId?: number | null) => Promise<any[]>
      createStudent: (data: any) => Promise<any>
      updateStudent: (data: any) => Promise<{ success: boolean }>
      deleteStudent: (id: number) => Promise<{ success: boolean }>
      getAttendance: (params: { date: string; classroom: number }) => Promise<any[]>
      saveAttendance: (data: any) => Promise<{ success: boolean }>
      importStudentsExcel: (students: any[]) => Promise<ImportStudentsResult>
      exportData: () => Promise<any>
      importData: (data: any) => Promise<{ success: boolean; error?: string }>
      getSchedule: (classroomId: number) => Promise<any[]>
      saveSchedule: (data: any) => Promise<{ success: boolean }>
      getGrades: (params: { classroom: number; semester: number; year: string }) => Promise<any[]>
      saveGrades: (data: any) => Promise<{ success: boolean }>
      getHealth: (params: { classroom: number; date: string }) => Promise<any[]>
      saveHealth: (data: any) => Promise<{ success: boolean }>
    }
  }
}
