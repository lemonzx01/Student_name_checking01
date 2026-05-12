const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Classrooms
  getClassrooms: () => ipcRenderer.invoke('get-classrooms'),
  createClassroom: (data) => ipcRenderer.invoke('create-classroom', data),
  updateClassroom: (data) => ipcRenderer.invoke('update-classroom', data),
  deleteClassroom: (id) => ipcRenderer.invoke('delete-classroom', id),

  // Students
  getStudents: (classroomId) => ipcRenderer.invoke('get-students', classroomId),
  createStudent: (data) => ipcRenderer.invoke('create-student', data),
  updateStudent: (data) => ipcRenderer.invoke('update-student', data),
  deleteStudent: (id) => ipcRenderer.invoke('delete-student', id),
  searchStudents: (query) => ipcRenderer.invoke('search-students', query),

  // Student Notes (บันทึกประจำตัวนักเรียน)
  getStudentNotes: (studentId) => ipcRenderer.invoke('get-student-notes', studentId),
  addStudentNote: (data) => ipcRenderer.invoke('add-student-note', data),
  deleteStudentNote: (id) => ipcRenderer.invoke('delete-student-note', id),

  // Attendance
  getAttendance: (params) => ipcRenderer.invoke('get-attendance', params),
  getAttendanceDates: (params) => ipcRenderer.invoke('get-attendance-dates', params),
  getAllAttendance: (classroomId) => ipcRenderer.invoke('get-attendance-all', classroomId),
  saveAttendance: (data) => ipcRenderer.invoke('save-attendance', data),

  // Health
  getHealth: (params) => ipcRenderer.invoke('get-health', params),
  saveHealth: (data) => ipcRenderer.invoke('save-health', data),
  getAllHealth: (classroomId) => ipcRenderer.invoke('get-all-health', classroomId),

  // Grades
  getGrades: (params) => ipcRenderer.invoke('get-grades', params),
  saveGrades: (data) => ipcRenderer.invoke('save-grades', data),

  // Schedule
  getSchedule: (classroom) => ipcRenderer.invoke('get-schedule', classroom),
  saveSchedule: (data) => ipcRenderer.invoke('save-schedule', data),

  // Subjects (rename)
  renameSubjectCode: (data) => ipcRenderer.invoke('rename-subject-code', data),
  renameSubjectName: (data) => ipcRenderer.invoke('rename-subject-name', data),

  // Backup (manual export/import)
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: (data) => ipcRenderer.invoke('import-data', data),
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),

  // Auto-backup (daily .db file backup)
  getBackupInfo: () => ipcRenderer.invoke('get-backup-info'),
  openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  restoreBackup: (fileName) => ipcRenderer.invoke('restore-backup', fileName),

  // Stats (สำหรับแสดงผลกระทบก่อน destructive op)
  getClassroomStats: (id) => ipcRenderer.invoke('get-classroom-stats', id),
  getAllStats: () => ipcRenderer.invoke('get-all-stats'),

  // Import Students from Excel
  importStudentsExcel: (students) => ipcRenderer.invoke('import-students-excel', students),

  // Sprint 2: Photos
  saveStudentPhoto: (data) => ipcRenderer.invoke('save-student-photo', data),
  deleteStudentPhoto: (studentId) => ipcRenderer.invoke('delete-student-photo', studentId),
  getPhotoDataUrl: (photoPath) => ipcRenderer.invoke('get-photo-data-url', photoPath),

  // Sprint 2: Trash (recycle bin)
  getTrashedStudents: () => ipcRenderer.invoke('get-trashed-students'),
  restoreStudent: (data) => ipcRenderer.invoke('restore-student', data),
  purgeStudent: (id) => ipcRenderer.invoke('purge-student', id),
  emptyTrash: () => ipcRenderer.invoke('empty-trash'),

  // Sprint 2: Duplicate classroom
  duplicateClassroom: (data) => ipcRenderer.invoke('duplicate-classroom', data),

  // Sprint 2: Dashboard stats
  getDashboardStats: (classroomId) => ipcRenderer.invoke('get-dashboard-stats', classroomId),

  // Sprint 3: Archive classrooms
  getArchivedClassrooms: () => ipcRenderer.invoke('get-archived-classrooms'),
  archiveClassroom: (id) => ipcRenderer.invoke('archive-classroom', id),
  unarchiveClassroom: (id) => ipcRenderer.invoke('unarchive-classroom', id),
  promoteStudents: (data) => ipcRenderer.invoke('promote-students', data),
})
