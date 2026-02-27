export {}

declare global {
  interface Window {
    electronAPI?: {
      // Classrooms
      getClassrooms: () => Promise<any[]>
      createClassroom: (data: { name: string; level: string; academic_year: string }) => Promise<any>
      updateClassroom: (data: { id: number; name: string; level: string; academic_year: string }) => Promise<{ success: boolean }>
      deleteClassroom: (id: number) => Promise<{ success: boolean }>

      // Students
      getStudents: (classroomId?: number | null) => Promise<any[]>
      createStudent: (data: any) => Promise<any>
      updateStudent: (data: any) => Promise<{ success: boolean }>
      deleteStudent: (id: number) => Promise<{ success: boolean }>

      // Attendance
      getAttendance: (params: { date: string; classroom: number }) => Promise<any[]>
      saveAttendance: (data: any) => Promise<{ success: boolean }>

      // Grades
      getGrades: (params: { classroom: number; semester: number; year: string }) => Promise<any[]>
      saveGrades: (data: any) => Promise<{ success: boolean }>

      // Schedule
      getSchedule: (classroom: number) => Promise<any[]>
      saveSchedule: (data: any) => Promise<{ success: boolean }>

      // Backup
      exportData: () => Promise<any>
      importData: (data: any) => Promise<{ success: boolean; error?: string }>
      
      // Import Students from Excel
      importStudentsExcel: (students: any[]) => Promise<{ success: boolean; imported: number; skipped: number; error?: string }>
    }
  }
}
