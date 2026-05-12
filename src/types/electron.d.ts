import type { ImportStudentsResult, Student } from '@/types'

export {}

declare global {
  interface Window {
    electronAPI?: {
      // Classrooms
      getClassrooms: () => Promise<any[]>
      createClassroom: (data: {
        name: string
        level: string
        academic_year: string
        color?: string | null
      }) => Promise<any>
      updateClassroom: (data: {
        id: number
        name: string
        level: string
        academic_year: string
        color?: string | null
      }) => Promise<{ success: boolean }>
      deleteClassroom: (id: number) => Promise<{ success: boolean }>

      // Students
      getStudents: (classroomId?: number | null) => Promise<any[]>
      createStudent: (data: any) => Promise<any>
      updateStudent: (data: any) => Promise<{ success: boolean }>
      deleteStudent: (id: number) => Promise<{ success: boolean }>
      searchStudents: (query: string) => Promise<Student[]>

      // Attendance
      getAttendance: (params: { date: string; classroom: number }) => Promise<any[]>
      getAttendanceDates: (params: { classroom: number; yearMonth: string }) => Promise<string[]>
      getAllAttendance: (classroomId: number) => Promise<any[]>
      saveAttendance: (data: any) => Promise<{ success: boolean }>

      // Health
      getHealth: (params: { classroom: number; date: string }) => Promise<any[]>
      saveHealth: (data: {
        classroom: number
        date: string
        entries: Array<{
          student_id: number
          brushed_teeth: boolean
          drank_milk: boolean
          weight_kg?: number | null
          height_cm?: number | null
        }>
      }) => Promise<{ success: boolean }>
      getAllHealth: (classroomId: number) => Promise<any[]>

      // Grades
      getGrades: (params: { classroom: number; semester: number; year: string }) => Promise<any[]>
      saveGrades: (data: any) => Promise<{ success: boolean }>

      // Schedule
      getSchedule: (classroomId: number) => Promise<any[]>
      saveSchedule: (data: any) => Promise<{ success: boolean }>

      // Subjects (rename helpers)
      renameSubjectCode: (data: {
        from: string
        to: string
      }) => Promise<{ gradesUpdated: number; schedulesUpdated: number }>
      renameSubjectName: (data: { code: string; newName: string }) => Promise<{ updated: number }>

      // Student Notes
      getStudentNotes: (studentId: number) => Promise<any[]>
      addStudentNote: (data: { student_id: number; date: string; note: string }) => Promise<any>
      deleteStudentNote: (id: number) => Promise<{ success: boolean }>

      // Excel import
      importStudentsExcel: (students: any[]) => Promise<ImportStudentsResult>

      // Backup / restore (manual)
      exportData: () => Promise<any>
      importData: (data: any) => Promise<{ success: boolean; error?: string }>
      clearAllData: () => Promise<{ success: boolean }>

      // Auto-backup
      getBackupInfo: () => Promise<{
        lastBackup: string | null
        count: number
        folder: string | null
        error?: string
      }>
      openBackupFolder: () => Promise<{ success: boolean; folder?: string; error?: string }>
      listBackups: () => Promise<Array<{ fileName: string; date: string; sizeBytes: number }>>
      restoreBackup: (fileName: string) => Promise<{ success: boolean; error?: string }>

      // Stats สำหรับแสดงผลกระทบก่อน destructive op
      getClassroomStats: (id: number) => Promise<{
        studentCount: number
        attendanceCount: number
        gradeCount: number
        healthCount: number
        scheduleCount: number
      }>
      getAllStats: () => Promise<{
        classroomCount: number
        studentCount: number
        attendanceCount: number
        gradeCount: number
        healthCount: number
        scheduleCount: number
      }>

      // Sprint 2: Photos
      saveStudentPhoto: (data: {
        studentId: number
        fileBuffer: Uint8Array | ArrayBuffer
        ext: string
      }) => Promise<{ success: boolean; photo_path?: string; error?: string }>
      deleteStudentPhoto: (studentId: number) => Promise<{ success: boolean; error?: string }>
      getPhotoDataUrl: (photoPath: string | null | undefined) => Promise<string | null>

      // Sprint 2: Trash (recycle bin)
      getTrashedStudents: () => Promise<any[]>
      restoreStudent: (data: {
        id: number
        newClassroomId?: number | null
      }) => Promise<{ success: boolean; error?: string }>
      purgeStudent: (id: number) => Promise<{ success: boolean; error?: string }>
      emptyTrash: () => Promise<{ success: boolean; purged: number; error?: string }>

      // Sprint 2: Duplicate classroom (+ Sprint 3: promote / archive)
      duplicateClassroom: (data: {
        sourceId: number
        newName: string
        newAcademicYear: string
        promoteStudents?: boolean
        archiveSource?: boolean
      }) => Promise<{ success: boolean; id?: number; name?: string; movedStudents?: number; error?: string }>

      // Sprint 3: Archive classrooms
      getArchivedClassrooms: () => Promise<any[]>
      archiveClassroom: (id: number) => Promise<{ success: boolean; error?: string }>
      unarchiveClassroom: (id: number) => Promise<{ success: boolean; error?: string }>
      promoteStudents: (data: {
        fromClassroomId: number
        toClassroomId: number
      }) => Promise<{ success: boolean; moved: number; error?: string }>

      // Sprint 2: Dashboard stats
      getDashboardStats: (classroomId?: number | null) => Promise<{
        scope: 'classroom' | 'all'
        classroomId: number | null
        classroomCount: number
        studentCount: number
        topAbsent: Array<{
          id: number
          first_name: string
          last_name: string
          title: string | null
          classroom_name: string | null
          photo_path: string | null
          absent_count: number
        }>
        bmiAbnormal: Array<{
          id: number
          title: string | null
          first_name: string
          last_name: string
          classroom_name: string | null
          photo_path: string | null
          bmi: number
          status: string
        }>
        recentStudents: Array<{
          id: number
          first_name: string
          last_name: string
          title: string | null
          classroom_name: string | null
          photo_path: string | null
          created_at: string
        }>
        recentAttendance: Array<{
          date: string
          classroom_id: number
          classroom_name: string | null
          count: number
        }>
        latestClassroom: {
          id: number
          name: string
          avg_score: number | null
        } | null
      }>
    }
  }
}
