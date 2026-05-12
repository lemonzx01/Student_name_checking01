# ระบบจัดการชั้นเรียนและนักเรียน (Offline Classroom Management System)

## 1. ภาพรวมโปรเจกต์

- **ชื่อโปรเจกต์**: School Classroom Management System
- **ประเภท**: Desktop Application (Offline-first)
- **เทคโนโลยี**: Next.js 16 + Electron 33 + SQLite
- **ผู้ใช้งานเป้าหมาย**: ครูประจำชั้น ครูผู้สอน ผู้บริหารโรงเรียน
- **ภาษา**: ไทย (UI ภาษาไทยทั้งหมด)
- **ออฟไลน์ 100%**: ข้อมูลทั้งหมดเก็บใน `school.db` บนเครื่องครู ไม่ต้องเชื่อมต่ออินเทอร์เน็ต

## 2. Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 18 + TypeScript 5
- **UI**: Tailwind CSS 3 + lucide-react icons + class-variance-authority
- **Desktop**: Electron 33 + electron-builder 25 (portable .exe)
- **Database**: SQLite (better-sqlite3 12) — WAL mode, FK ON
- **State Management**: Zustand 5
- **Forms**: React Hook Form 7 + Zod 4
- **Logging**: electron-log
- **Export**: xlsx (Excel), jspdf + jspdf-autotable (PDF), file-saver
- **Font**: @fontsource/noto-sans-thai (bundle ไม่ต้องโหลดจาก Google Fonts)

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
- **Font Family**: Noto Sans Thai, system-ui
- **Headings**: Bold, 24px/20px/16px
- **Body**: Regular, 14px
- **Caption**: Regular, 12px

### Layout
- **Sidebar**: 220px fixed width, dark theme
- **Header**: 60px height
- **Content Padding**: 24px
- **Border Radius**: 8px (buttons), 12px (cards), 16px (modals)

## 4. สถาปัตยกรรมระบบ (Dual Data Layer)

ระบบมี data layer 2 ชุดที่ต้อง sync schema ให้ตรงกันเสมอ:

1. **Electron IPC Layer** (`electron/main.js` + `electron/preload.js`)
   - ใช้เมื่อ build เป็น packaged app (production)
   - Renderer เรียกผ่าน `window.electronAPI.*`
   - DB อยู่ที่ `app.getPath('userData')/school.db`

2. **Web API Layer** (`src/app/api/*` + `src/lib/db.ts`)
   - ใช้เมื่อรัน `npm run dev` (development)
   - Renderer เรียกผ่าน `fetch('/api/...')`
   - DB อยู่ที่ `process.cwd()/school.db` (override ได้ผ่าน `SCHOOL_DB_PATH`)

ทั้งสอง layer ต้อง:
- CREATE TABLE ใช้ schema ตรงกัน
- API contract (input/output shape) ตรงกัน
- Validation rules เหมือนกัน

## 5. Database Schema

### classrooms
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | รหัสห้องเรียน |
| name | TEXT | ชื่อห้อง (เช่น ป.1/1) |
| level | TEXT | ระดับชั้น |
| academic_year | TEXT | ปีการศึกษา (พ.ศ.) |
| color | TEXT | สี hex สำหรับ card |
| archived_at | DATETIME | เก็บถาวร (NULL = active) |
| created_at | DATETIME | วันที่สร้าง |

### students
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | รหัสภายในระบบ |
| student_id | TEXT UNIQUE | รหัสนักเรียน |
| national_id | TEXT | เลขประจำตัวประชาชน |
| student_number | TEXT | เลขที่ในห้อง |
| title | TEXT | คำนำหน้า |
| first_name, last_name | TEXT | ชื่อ–นามสกุล |
| classroom_id | INTEGER FK | ห้องเรียน |
| classroom_label | TEXT | ชื่อห้อง (denormalized) |
| gender | TEXT | เพศ (ชาย/หญิง) |
| birth_date, age_years | TEXT | วันเกิด, อายุ |
| weight_kg, height_cm | REAL | น้ำหนัก/ส่วนสูง |
| house_no, village_no | TEXT | ที่อยู่ |
| guardian_* (title/name/occupation/relation/phone) | TEXT | ผู้ปกครอง |
| father_*, mother_* | TEXT | บิดา/มารดา |
| disadvantage | TEXT | ด้อยโอกาส |
| source_payload | TEXT | JSON ดิบจาก import |
| photo_path | TEXT | ชื่อไฟล์รูป (เก็บใน photos/) |
| deleted_at | DATETIME | trash (auto-purge 30 วัน) |
| is_active | INTEGER | 1=active, 0=trashed/archived |
| created_at | DATETIME | |

### attendance
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| student_id, classroom_id | INTEGER FK | |
| date | TEXT | YYYY-MM-DD |
| status | TEXT | มา / ขาด / ลาป่วย / ลากิจ / สาย |
| note | TEXT | หมายเหตุ |

### health_check
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| student_id, classroom_id | INTEGER FK | |
| date | TEXT | |
| brushed_teeth, drank_milk | INTEGER | 0/1 |
| weight_kg, height_cm | REAL | บันทึกรายวัน |

### grades
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| student_id, classroom_id | INTEGER FK | |
| subject_code | TEXT | รหัสวิชา |
| score | REAL | คะแนนรวม (midterm + final) |
| midterm_score, final_score | REAL | คะแนนกลางภาค/ปลายภาค |
| semester | INTEGER | 1 หรือ 2 |
| academic_year | TEXT | |

### schedules
ตารางสอน — day_of_week (1–7) × period (1–10) × subject

### subjects
รายวิชา (default 9 วิชาหลัก + ผู้ใช้เพิ่มเองได้)

### student_notes
บันทึกพฤติกรรม/ข้อสังเกตรายบุคคลตามวันที่

## 6. ฟีเจอร์หลัก

### 6.1 หน้าแรก (Dashboard)
- Cards ห้องเรียน grid layout
- สถิติรวม: นักเรียน, BMI ผิดปกติ, นักเรียนที่ขาดบ่อย (30 วัน)
- Recent students + recent attendance

### 6.2 จัดการนักเรียน
- Data Table + search real-time + pagination
- Modal เพิ่ม/แก้ไข/ลบ
- Import Excel (.xlsx) พร้อม mapping
- Export Excel/PDF
- รูปนักเรียน (จำกัด 5MB, รองรับ jpg/png/gif/webp)
- Trash + restore (auto-purge หลัง 30 วัน)

### 6.3 เช็คชื่อ
- Toggle: มา (เขียว) / ขาด (แดง) / ลาป่วย-ลากิจ (เหลือง) / สาย (ส้ม)
- Date picker เปลี่ยนวัน + Keyboard navigation
- Auto-save (debounce 800ms)
- หน้ารายงาน: สรุปช่วงวันที่ + Export Excel/PDF

### 6.4 คะแนนและเกรด
- Data Grid Excel-like
- คะแนนกลางภาค (midterm_score) + ปลายภาค (final_score)
- คำนวณเกรดอัตโนมัติ (0, 1, 1.5, 2, 2.5, 3, 3.5, 4)
- Transcript รายบุคคล (PDF)
- Auto-save พร้อม dirty flag กัน race condition

### 6.5 ตารางสอน
- Time Grid: จันทร์–ศุกร์ × 8 คาบ
- Paint mode (วาดตารางด้วยการคลิก-ลาก)
- ตรวจคาบซ้ำข้ามห้อง (clash detection)
- Copy ตาราง / Template
- Undo (Ctrl+Z)

### 6.6 สุขภาพ
- บันทึกน้ำหนัก/ส่วนสูง + BMI อัตโนมัติ
- สถานะ: ผอม / ปกติ / น้ำหนักเกิน / อ้วน
- ปฏิทินดูประวัติ + Export Excel

### 6.7 สำรองข้อมูล
- Daily auto-backup (เก็บ 30 วันล่าสุด)
- Manual snapshot ก่อนทำ destructive operation (restore, clear-all, import)
- WAL checkpoint ก่อน copy file → atomic
- Export/Import JSON ทั้ง DB

### 6.8 ย้ายขึ้นชั้น (Promote)
- Duplicate ห้อง + ย้ายนักเรียน + archive ห้องเดิม ใน transaction เดียว
- ใช้เมื่อขึ้นปีการศึกษาใหม่

## 7. โครงสร้างโฟลเดอร์

```
school_system/
├── electron/
│   ├── main.js          # Electron main process (IPC + DB + window)
│   └── preload.js       # ContextBridge API exposure
├── src/
│   ├── app/             # Next.js 16 App Router
│   │   ├── page.tsx          # หน้าแรก (รายห้อง)
│   │   ├── dashboard/        # Dashboard
│   │   ├── students/         # จัดการนักเรียน
│   │   ├── attendance/       # เช็คชื่อ + รายงาน
│   │   ├── grades/           # คะแนน (midterm + final)
│   │   ├── health/           # สุขภาพ
│   │   ├── schedule/         # ตารางสอน
│   │   ├── report-card/      # Transcript
│   │   ├── export-excel/     # Export รวม
│   │   ├── archive/          # ห้องที่เก็บถาวร
│   │   ├── trash/            # นักเรียนที่ลบ
│   │   ├── settings/         # ตั้งค่า + backup
│   │   └── api/              # Web API routes (dev mode)
│   ├── components/
│   ├── lib/
│   │   ├── db.ts             # SQLite client (Web API)
│   │   ├── client-data.ts    # client helpers
│   │   ├── electron.ts       # detect/wrap electronAPI
│   │   └── hooks/            # useAutoSave, useConfirm, etc.
│   └── types/
├── public/
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── SPEC.md
├── TEST_CASE.md
└── README.md
```

## 8. Security & Hardening

### 8.1 Electron BrowserWindow
- `contextIsolation: true` + `nodeIntegration: false` + `sandbox: true`
- `webSecurity: true`
- `setWindowOpenHandler` — external URL ถูกส่งไป default browser
- `will-navigate` guard — กัน renderer redirect ออกไซต์ภายนอก
- Preload ใช้ `contextBridge` whitelist API เท่านั้น

### 8.2 SQL Safety
- ใช้ prepared statements ทุก query
- Transaction ครอบ destructive operations
- WAL mode + foreign keys ON

### 8.3 Input Validation
- รูปนักเรียน: จำกัด 5MB + verify magic bytes (jpg/png/gif/webp)
- Note: reject empty string หลัง trim
- IDs: validate เป็น positive integer ก่อน query

### 8.4 Backup Safety
- WAL checkpoint(FULL) ก่อน copy DB file → atomic snapshot
- Pre-import snapshot อัตโนมัติก่อนล้างข้อมูล
- Auto-backup รายวัน (เก็บ 30 ไฟล์)

## 9. การติดตั้งและรัน

### Development
```bash
npm install
npm run electron:dev      # รัน Next.js + Electron พร้อมกัน
# หรือ
npm run dev               # รัน Next.js เฉย ๆ (Web mode)
```

### Production Build
```bash
npm run build:electron    # สร้าง dist/School Management System.exe (portable)
```

### Path
- Dev: `process.cwd()/school.db`
- Prod: `%APPDATA%/school-system/school.db` (Windows) / `~/Library/Application Support/school-system/school.db` (Mac)

## 10. Acceptance Criteria

- [x] รันแบบ offline ได้ 100%
- [x] สร้าง/แก้ไข/ลบ ห้องเรียนได้
- [x] สร้าง/แก้ไข/ลบ นักเรียนได้ (+ trash + restore)
- [x] รูปนักเรียน (validate ขนาด + magic bytes)
- [x] เช็คชื่อรายวัน (keyboard navigation + auto-save)
- [x] คะแนน + grade items + คำนวณเกรดอัตโนมัติ (dirty flag กัน race)
- [x] บันทึกน้ำหนัก/ส่วนสูง + BMI
- [x] ตารางสอน + clash detection + paint mode
- [x] Import/Export Excel (นักเรียน, คะแนน, สุขภาพ)
- [x] Export PDF (ปพ.5, ปพ.6, transcript)
- [x] รายงานเช็คชื่อ
- [x] ระบบค้นหา (Sidebar)
- [x] Auto-backup รายวัน + pre-destructive snapshot
- [x] Promote ห้องเรียน (transaction-safe)
- [x] Security hardening (sandbox, magic bytes, atomic backup)
- [x] Dual data layer sync (Electron IPC + Web API)
- [x] Build เป็น .exe portable
