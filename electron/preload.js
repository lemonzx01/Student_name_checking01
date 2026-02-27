const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Classrooms
  getClassrooms: () => ipcRenderer.invoke('get-classrooms'),
  createClassroom: (data) => ipcRenderer.invoke('create-classroom', data),
  deleteClassroom: (id) => ipcRenderer.invoke('delete-classroom', id),

  // Students
  getStudents: (classroomId) => ipcRenderer.invoke('get-students', classroomId),
  createStudent: (data) => ipcRenderer.invoke('create-student', data),
  updateStudent: (data) => ipcRenderer.invoke('update-student', data),
  deleteStudent: (id) => ipcRenderer.invoke('delete-student', id),

  // Attendance
  getAttendance: (params) => ipcRenderer.invoke('get-attendance', params),
  saveAttendance: (data) => ipcRenderer.invoke('save-attendance', data),

  // Grades
  getGrades: (params) => ipcRenderer.invoke('get-grades', params),
  saveGrades: (data) => ipcRenderer.invoke('save-grades', data),

  // Schedule
  getSchedule: (classroom) => ipcRenderer.invoke('get-schedule', classroom),
  saveSchedule: (data) => ipcRenderer.invoke('save-schedule', data),

  // Backup
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: (data) => ipcRenderer.invoke('import-data', data),
  
  // Import Students from Excel
  importStudentsExcel: (students) => ipcRenderer.invoke('import-students-excel', students),
})
