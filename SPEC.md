# ระบบจัดการชั้นเรียนและนักเรียน (Offline Classroom Management System)

## 1. ภาพรวมโปรเจกต์

- **ชื่อโปรเจกต์**: School Classroom Management System
- **ประเภท**: Desktop Application (Offline-first)
- **เทคโนโลยี**: Next.js + Electron + SQLite
- **ผู้ใช้งานเป้าหมาย**: ครูโรงเรียน ผู้บริหารโรงเรียน
- **ภาษา**: ไทย (UI ภาษาไทยทั้งหมด)

## 2. Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **UI Library**: Tailwind CSS + Shadcn UI
- **Desktop**: Electron + electron-builder
- **Database**: SQLite (better-sqlite3)
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod

## 3. UI/UX Design System

### Color Palette
- **Background**: `#F8FAFC` (slate-50)
- **Surface**: `#FFFFFF`
- **Primary**: `#3B82F6` (blue-500)
- **Success**: `#10B981` (green-500)
- **Warning**: `#F59E0B` (amber-500)
- **Danger**: `#EF4444` (red-500)
- **Text Primary**: `#0F172A` (slate-900)
- **Text Secondary**: `#64748B` (slate-500)
- **Border**: `#E2E8F0` (slate-200)

### Typography
- **Font Family**: "Kanit", "TH Sarabun New", system-ui
- **Headings**: Bold, 24px/20px/16px
- **Body**: Regular, 14px
- **Caption**: Regular, 12px

### Layout
- **Sidebar**: 220px fixed width, dark theme (#0F172A)
- **Header**: 60px height
- **Content Padding**: 24px
- **Border Radius**: 8px (buttons), 12px (cards), 16px (modals)

## 4. Database Schema

### Tables

#### classrooms
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | รหัสห้องเรียน |
| name | TEXT | ชื่อห้อง (เช่น ม.1/1) |
| level | TEXT | ระดับชั้น |
| academic_year | TEXT | ปีการศึกษา |
| created_at | DATETIME | วันที่สร้าง |

#### students
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | รหัสนักเรียน |
| student_id | TEXT | รหัสประจำตัว |
| first_name | TEXT | ชื่อ |
| last_name | TEXT | นามสกุล |
| classroom_id | INTEGER FK | ห้องเรียน |
| gender | TEXT | เพศ |
| birth_date | DATE | วันเกิด |
| is_active | INTEGER | สถานะ (1=active, 0=inactive) |
| created_at | DATETIME | วันที่สร้าง |

#### attendance
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| student_id | INTEGER FK | นักเรียน |
| date | DATE | วันที่ |
| status | TEXT | มา/ขาด/ลา/สาย |
| note | TEXT | หมายเหตุ |
| created_at | DATETIME | |

#### health_check
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| student_id | INTEGER FK | นักเรียน |
| date | DATE | วันที่ |
| brushed_teeth | INTEGER | แปรงฟัน (0/1) |
| drank_milk | INTEGER | ดื่มนม (0/1) |
| note | TEXT | หมายเหตุ |

#### grades
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| student_id | INTEGER FK | นักเรียน |
| subject | TEXT | วิชา |
| semester | INTEGER | ภาคเรียน (1/2) |
| academic_year | TEXT | ปีการศึกษา |
| score | REAL | คะแนน |
| created_at | DATETIME | |

#### subjects
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| name | TEXT | ชื่อวิชา |
| code | TEXT | รหัสวิชา |
| color | TEXT | สี (hex) |

#### schedule
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| classroom_id | INTEGER FK | ห้องเรียน |
| day_of_week | INTEGER | วัน (1-5) |
| period | INTEGER | คาบ (1-8) |
| subject_id | INTEGER FK | วิชา |
| teacher_name | TEXT | ชื่อครู |

## 5. ฟีเจอร์หลัก

### 5.1 หน้าแรก (Home)
- แสดง cards ห้องเรียน grid layout
- ปุ่ม "+ สร้างห้องเรียนใหม่"
- Card แสดง: ชื่อห้อง, จำนวนนักเรียน, ปีการศึกษา
- Click เข้าห้องเรียน

### 5.2 ระบบจัดการนักเรียน
- Data Table พร้อม pagination
- Search แบบ real-time
- Modal เพิ่ม/แก้ไข/ลบ นักเรียน
- Import Excel (.xlsx)
- Export Excel/PDF

### 5.3 ระบบเช็คชื่อ
- ตารางแสดงรายชื่อนักเรียน
- Toggle สถานะ: มา(เขียว)/ขาด(แดง)/ลา(เหลือง)/สาย(ส้ม)
- Date picker เปลี่ยนวัน
- Checkbox สุขภาพ: แปรงฟัน, ดื่มนม
- Keyboard navigation (Tab, Enter, Arrow keys)

### 5.4 ระบบคะแนนและเกรด
- Data Grid กรอกคะแนน (Excel-like)
- วิชาหลัก 9 วิชา
- คำนวณเกรดอัตโนมัติ
- Transcript รายบุคคล
- Export PDF

### 5.5 ตารางสอน
- Time Grid: วันจันทร์-ศุกร์ × คาบ 1-8
- Card แต่ละช่องแสดง: วิชา, ครู
- สีต่างกันตามวิชา

### 5.6 สำรองข้อมูล
- Export SQLite/JSON
- Import Database

## 6. โครงสร้างโฟลเดอร์

```
school_system/
├── electron/
│   ├── main.ts          # Electron main process
│   ├── preload.ts       # Preload script
│   └── database.ts      # SQLite operations
├── src/
│   ├── app/            # Next.js App Router
│   │   ├── page.tsx    # Home (Classroom list)
│   │   ├── layout.tsx  # Root layout with sidebar
│   │   ├── students/   # Student management
│   │   ├── attendance/ # Attendance system
│   │   ├── grades/      # Grades system
│   │   ├── schedule/    # Timetable
│   │   └── settings/    # Backup/Restore
│   ├── components/      # Reusable components
│   │   ├── ui/         # Shadcn UI components
│   │   └── ...
│   ├── lib/            # Utilities
│   │   ├── db.ts       # Database client
│   │   └── utils.ts    # Helper functions
│   └── types/          # TypeScript types
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── electron-builder.json
```

## 7. สิ่งที่เพิ่มใหม่ (Update)

### 7.1 Export/Import Data
- **Export JSON**: ส่งออกข้อมูลทั้งหมดเป็น JSON
- **Import JSON**: นำเข้าข้อมูลจาก JSON (แทนที่ข้อมูลเดิม)

### 7.2 Import/Export Excel นักเรียน
- **Import Excel**: นำเข้านักเรียนจากไฟล์ Excel (.xlsx, .xls)
- **Export Excel**: ส่งออกรายชื่อนักเรียนเป็น Excel

### 7.3 Export Excel คะแนน
- **Export Excel**: ส่งออกคะแนนเป็น Excel พร้อมค่าเฉลี่ย

### 7.4 ระบบค้นหา (Search)
- **Search**: ค้นหานักเรียนจาก Sidebar
- แสดงผลลัพธ์แบบ Real-time
- ค้นหาจาก ชื่อ, นามสกุล, รหัสนักเรียน

### 7.5 รายงานการเช็คชื่อ (Attendance Report)
- **หน้ารายงาน**: เลือกห้องเรียน + ช่วงวันที่
- **สรุป**: จำนวนมา/ขาด/สาย/ลา
- **Export Excel**: ส่งออกรายงานเป็น Excel

### 7.6 ไฟล์ที่แก้ไข
- `electron/main.js` - เพิ่ม importStudentsExcel handler
- `electron/preload.js` - เพิ่ม API
- `src/app/api/settings/route.ts` - import JSON API
- `src/app/api/students/route.ts` - เพิ่ม search parameter
- `src/app/api/students/import/route.ts` - Import Excel API (ใหม่)
- `src/app/api/search/route.ts` - Search API (ใหม่)
- `src/app/students/page.tsx` - Import/Export Excel buttons
- `src/app/grades/page.tsx` - Export Excel button
- `src/app/attendance/report/page.tsx` - หน้ารายงาน (ใหม่)
- `src/components/Sidebar.tsx` - เพิ่ม Search + เมนูรายงาน
- `src/types/electron.d.ts` - เพิ่ม TypeScript types สำหรับ API ใหม่

### 7.7 หน้าน้ำหนัก/ส่วนสูง (Health Page) - 27 Feb 2026
- **หน้าใหม่**: `src/app/health/page.tsx` (ใหม่)
- **API ใหม่**: `src/app/api/health/route.ts` (ใหม่)
- **ฟีเจอร์**:
  - บันทึกน้ำหนักและส่วนสูงของนักเรียน
  - คำนวณ BMI อัตโนมัติ
  - แสดงสถานะ BMI (ผอม/ปกติ/น้ำหนักเกิน/อ้วน/อ้วนมาก)
  - Export Excel น้ำหนัก/ส่วนสูง/BMI

### 7.8 รวมไฟล์ Export Excel - 27 Feb 2026
- **แก้ไข**: `src/app/export-excel/page.tsx`
- **ฟีเจอร์ใหม่**:
  - ปุ่ม "สรุปรวมทั้งหมด" - Export ข้อมูลทั้งหมด (เช็คชื่อ + สุขภาพ + น้ำหนัก/ส่วนสูง) ในไฟล์ Excel เดียว
  - หลาย Sheet ในไฟล์เดียว (แยกตามหมวด)

### 7.9 แก้ไข/ลบห้องเรียน - 27 Feb 2026
- **ไฟล์ที่แก้ไข**:
  - `src/app/page.tsx` - เพิ่มฟังก์ชันแก้ไขและลบห้องเรียน
  - `src/components/ClassroomCard.tsx` - เพิ่มปุ่มแก้ไขและลบ (แสดงเมื่อ hover)
  - `src/components/CreateClassroomModal.tsx` - รองรับโหมดแก้ไข + ปรับปรุงUIใหม่
  - `src/app/api/classrooms/route.ts` - เพิ่ม PUT API สำหรับแก้ไข
  - `src/lib/db.ts` - เพิ่มฟังก์ชัน updateClassroom
  - `src/types/electron.d.ts` - เพิ่ม updateClassroom type

### 7.10 แก้ไข Bug APIs (27 Feb 2026)

#### ปัญหาที่พบ:
1. **Attendance API 500 Error** - `window.electronAPI` ถูกเรียกที่ module level ทำให้ server crash
2. **Settings Export 404** - Frontend เรียก `/api/settings/export` แต่ route ไม่มี
3. **Favicon 404** - ไม่มี favicon.ico ในโปรเจกต์

#### การแก้ไข:
- **API Routes ที่แก้ไข**:
  - `src/app/api/attendance/route.ts` - ย้าย isElectron check เข้าไปใน function
  - `src/app/api/settings/route.ts` - ย้าย isElectron check เข้าไปใน function
  - `src/app/api/settings/export/route.ts` - สร้างใหม่ (route ใหม่)
  - `src/app/api/students/import/route.ts` - ย้าย isElectron check เข้าไปใน function
  - `src/app/api/search/route.ts` - ลบ isElectron ที่ไม่ใช้ออก
  - `src/app/api/schedule/route.ts` - ย้าย isElectron check เข้าไปใน function
  - `src/app/api/grades/route.ts` - ย้าย isElectron check เข้าไปใน function

- **Favicon**:
  - `public/favicon.ico` - สร้างไฟล์ favicon
  - `src/app/layout.tsx` - เพิ่ม icons config ใน metadata

#### สาเหตุของ Bug:
Next.js API routes ทำงานบน server-side ซึ่งไม่มี `window` object การเรียก `typeof window !== 'undefined'` ที่ module level จะทำให้โค้ดทำงานผิดพลาดตอน build หรือ import

---

## 8. Acceptance Criteria

- [x] รันแบบ offline ได้ 100%
- [x] สร้าง/แก้ไข/ลบ ห้องเรียนได้
- [x] สร้าง/แก้ไข/ลบ นักเรียนได้
- [x] เช็คชื่อรายวันได้ (keyboard navigation)
- [x] กรอกคะแนนและคำนวณเกรดอัตโนมัติ
- [x] จัดตารางสอนได้
- [x] Import/Export Excel (นักเรียน)
- [x] Export Excel (คะแนน)
- [x] ระบบค้นหา (Search)
- [x] รายงานการเช็คชื่อ
- [x] Backup/Restore Database (JSON)
- [x] บันทึกน้ำหนัก/ส่วนสูง และคำนวณ BMI
- [x] Export Excel รวมทุกข้อมูล (เช็คชื่อ + สุขภาพ + น้ำหนัก/ส่วนสูง)
- [ ] Build เป็น .exe ได้
