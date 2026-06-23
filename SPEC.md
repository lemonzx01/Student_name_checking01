# ระบบจัดการชั้นเรียนและนักเรียน (Offline Classroom Management System)

> อัพเดทล่าสุด: 11 มิ.ย. 2026 — ปรับ Design System (flat design + dark mode), แก้ Electron runtime detection, ยกเครื่องระบบตารางสอน (clash scope + grade parsing)

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

### หลักการ (สำคัญ — ห้ามฝ่าฝืน)
- **Flat design เท่านั้น** — ห้ามใช้ gradient/ไล่สีตกแต่ง (เคยใส่แล้วถูกถอดออกตาม feedback ผู้ใช้)
  แยกชั้น UI ด้วยสีพื้นเดียว + เส้นขอบ + เงาบาง (`--shadow-xs/sm/md/lg`)
- **ใช้ CSS token เท่านั้น** — ห้าม hardcode สีอ่อนแบบ `bg-blue-50`/`ring-blue-200` ใน component
  เพราะ dark mode override เฉพาะ `bg-white`/`bg-slate-*`/`text-slate-*`/`border-slate-*`
  สีอื่นจะสว่างผิดที่ในธีมมืด → ใช้ `var(--primary-ghost)`, `var(--warning-soft)` ฯลฯ แทน
- **Animation ตอนเข้า ใช้ fill-mode `backwards` เท่านั้น** (ไม่ใช่ `both`/`forwards`)
  เพราะ animation ที่ fill ค้างบน transform/opacity จะสร้าง stacking context ถาวร
  ทำให้ element ที่มาทีหลังใน DOM วาดทับ dropdown/popup (เคยเป็นบั๊กปฏิทินโดนการ์ดทับ)
- Keyframe สุดท้ายของ entry animation ต้องเป็น `transform: none` (= ค่าธรรมชาติ) เพื่อไม่ให้ภาพกระตุก

### Color Tokens (กำหนดใน `src/app/globals.css` — มีครบทั้ง light + dark)
| Token | Light | บทบาท |
|---|---|---|
| `--bg` | `#f5f7fb` | พื้นหลังแอป |
| `--surface` / `--surface-soft` / `--surface-muted` | `#fff` / `#f8fafc` / `#f1f5f9` | การ์ด / พื้นรอง / hover row |
| `--primary` / `--primary-strong` / `--primary-soft` / `--primary-ghost` | `#2563eb` / `#1d4ed8` / `#dbeafe` / `#eff6ff` | สีแบรนด์ |
| `--accent` (warm) | `#f59e0b` | highlight ที่ไม่ใช่แบรนด์ |
| `--success` / `--warning` / `--danger` / `--info` (+ `-soft`, `-strong`) | เขียว/เหลือง/แดง/ฟ้า | สถานะ |
| `--text` / `--text-soft` / `--muted` / `--muted-soft` | `#0f1d35` → `#94a3b8` | ลำดับชั้นตัวอักษร |
| `--line` / `--line-soft` / `--line-strong` | `#e1e7f0` ฯลฯ | เส้นขอบ |
| `--nav` / `--nav-hover` / `--nav-active` | `#0f172a` / `#1e293b` / `#2563eb` | Sidebar |

Dark theme: override ทุก token ผ่าน `[data-theme="dark"]` (toggle ที่หน้า ตั้งค่า, เก็บใน `localStorage.theme`)

### Typography
- **Font Family**: Noto Sans Thai (bundle ผ่าน @fontsource), fallback Kanit/Inter/system-ui
- **Base font**: 17px (ขยายให้ครูอ่านง่าย) + ตัวเลือก large 19px / extra-large 21px (`data-font-size`)
- **Headings**: Bold — h1 ~28px, section title 14px bold

### Layout & Radius
- **Sidebar**: 280px fixed, ธีมเข้ม (`--nav`), ซ่อนบนมือถือ (hamburger + drawer)
- **Content Padding**: 20–28px (`p-5 md:p-7`)
- **Radius scale**: `--radius-sm` 8px (chip) / `--radius` 12px (ปุ่ม, input) / `--radius-md` 16px / `--radius-lg` 20px (การ์ด) / `--radius-xl` 28px (modal)
- **Touch target**: ปุ่มสูงขั้นต่ำ 40px (ยกเว้น `.btn-compact`)

### Base Components (class ใน globals.css — ใช้ซ้ำแทนเขียน utility ยาว)
`.card`, `.card-interactive`, `.btn` (+`-primary/-secondary/-ghost/-brand-ghost/-danger/-danger-ghost`, ขนาด `-sm/-lg/-icon`), `.input`, `.pill` (+โทนสี), `.empty-state`, `.hero-card` (การ์ดหัวหน้า — **ห้ามใส่ overflow:hidden** เพราะข้างในมี dropdown), `.nav-surface`, `.nav-item-active`, `.skeleton`, tooltip ผ่าน `[data-tip]`

### Shared UI Components
- `PageHeader` — หัวหน้าทุกหน้า: badge + title + subtitle + icon bubble สีตาม tone + ปุ่ม actions
  (มี `relative z-20` เพื่อให้ dropdown ใน actions ลอยเหนือเนื้อหาเสมอ — ห้ามถอด)
- `AutoSaveIndicator`, `Toast`/`UndoToast`, `ConfirmDialog`/`AlertDialog` (ผ่าน `useDialog`), `CalendarPicker` (พ.ศ.), `CustomSelect`, `GlobalSearch`, `StudentAvatar`, `Pagination`

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

### Runtime Detection (`src/lib/client-data.ts`)
ตัวเลือกเส้นทาง Electron IPC vs Web API ทำงานดังนี้:
1. ถ้า `window.electronAPI` มีอยู่ → ใช้ IPC ทันที (contextBridge inject ก่อน page script รันเสมอ)
2. ถ้า UA มีคำว่า "Electron" แต่ API ยังไม่มา → รอ polling สูงสุด **2 วินาที**
3. ถ้ารอแล้วยังไม่มา → **fallback ไป `/api/*`** (ห้าม throw)

ข้อ 3 สำคัญ: เบราว์เซอร์ฐาน Electron ตัวอื่น (เช่น preview ของ Claude Code desktop)
ก็มี "Electron" ใน UA — ถ้า throw แทน fallback หน้าเว็บจะว่างเปล่าทั้งที่ API ใช้ได้
(เคยเป็นบั๊กจริง — แก้แล้ว อย่า revert กลับไปใช้ timeout 10s + throw)

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
| status | TEXT | มา / ขาด / ลาป่วย / ลากิจ |
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
ตารางสอน — ใช้จริง: day_of_week 1–5 (จันทร์–ศุกร์) × period 1–6

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | |
| classroom_id | INTEGER FK | |
| day_of_week | INTEGER | 1=จันทร์ … 5=ศุกร์ |
| period | INTEGER | คาบ 1–6 (พักเที่ยงอยู่ระหว่างคาบ 3↔4 ไม่เก็บใน DB) |
| subject_code, subject_name | TEXT | รหัส/ชื่อวิชา |
| class_level | TEXT | ระดับชั้น (denormalized) |
| room | TEXT | ห้องเรียนพิเศษ (ถ้ามี) |

หมายเหตุ: คาบกิจกรรมคงที่ (พุธคาบ 6 = ลูกเสือ, พฤหัสคาบ 6 = ชุมนุม, ศุกร์คาบ 6 = สวดมนต์)
เป็น constant ฝั่ง UI (`FIXED_SLOTS`) — ไม่บันทึกลง DB และแก้ไขไม่ได้

### subjects
รายวิชา (default 9 วิชาหลัก + ผู้ใช้เพิ่มเองได้)

> **รหัสวิชา canonical** = `src/lib/constants/subjects.ts` (`DEFAULT_SUBJECTS`): `TH, MA, EN, SC, SO, HI, HE, AR, WO`
> - UI ใช้รายการนี้ผ่าน `useSubjects()` (เก็บ override ที่ localStorage `customSubjects`) — **ไม่ได้อ่านตาราง `subjects` ใน DB**
> - DB seed (ทั้ง `db.ts` และ `main.js`) ต้อง seed ด้วยรหัสชุดนี้ — main.js mirror ไว้ใน `CANONICAL_SUBJECTS` (sync มือ)
> - **Heal migration** (`healSubjectCodes`): DB ที่เคย seed/migrate ด้วยรหัสเก่า (`MATH/SCI/SOC/HIS/PE/ART/WORK/ENG`)
>   จะถูก remap → canonical ทั้งใน `subjects`, `schedules`, `grades` ตอนเปิด DB (idempotent) — กันช่องตารางเทา/ตัวนับคาบขึ้น 0

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
- Toggle 4 สถานะ: มา (เขียว) / ขาด (แดง) / ลาป่วย (เหลือง) / ลากิจ (ฟ้า)
- Date picker เปลี่ยนวัน + Keyboard navigation
- Auto-save (debounce 600ms)
- ปุ่ม "ตั้งทั้งหมด" — เซ็ตสถานะเดียวกันให้ทุกคนในคลิกเดียว
- หน้ารายงาน: สรุปช่วงวันที่ + Export Excel/PDF

### 6.4 คะแนนและเกรด
- Data Grid Excel-like
- คะแนนกลางภาค (midterm_score) + ปลายภาค (final_score)
- คำนวณเกรดอัตโนมัติ (0, 1, 1.5, 2, 2.5, 3, 3.5, 4)
- Transcript รายบุคคล (PDF)
- Auto-save พร้อม dirty flag กัน race condition

### 6.5 ตารางสอน
- **Time Grid**: จันทร์–ศุกร์ × 6 คาบ + พักเที่ยงคั่นระหว่างคาบ 3↔4
  คาบกิจกรรมคงที่ (`FIXED_SLOTS`): พุธ-6 ลูกเสือ, พฤหัส-6 ชุมนุม, ศุกร์-6 สวดมนต์ (แก้ไม่ได้)
- **Paint mode**: กดเลือกวิชาในแถบ palette → คลิกช่องเพื่อวาง → คลิกขวาเพื่อลบ (Esc = ออกจากโหมด)
- **Edit modal**: คลิกช่อง (ไม่ได้อยู่ paint mode) → เลือกวิชา + ระบุห้องเรียนพิเศษ
- **สร้างอัตโนมัติ** (`ScheduleTemplateDialog`): ตั้งจำนวนคาบ/วิชา (มีค่าเริ่มต้นตามมาตรฐาน สพฐ.)
  → ระบบวางวิชาหลักช่วงเช้า + กระจายข้ามวัน + รองรับคาบคู่ (ไม่เกิน 2 ติด, ไม่คร่อมพักเที่ยง)
  → ใช้ได้หลายห้องพร้อมกัน + option "สลับคาบให้ไม่ชนกัน" (generate ต่อห้องหลบ slot ที่ห้องอื่นใช้)
- **ตรวจคาบซ้ำข้ามห้อง** (clash detection): จับ "วิชาเดียวกันที่เวลาเดียวกันในหลายห้อง"
  (ครู specialist สอนซ้ำไม่ได้) — ไม่ใช่แค่ "สอง slot ทับกัน" เพราะครูประจำชั้นคนละคน
  - **ขอบเขตตรวจ (clash scope)**: `ทุกห้อง` (default) / `ระดับชั้น` / `เลือกเอง` — จำใน localStorage
  - ปุ่มเลือกชั้นสร้างจากระดับชั้นที่มีจริงในข้อมูล (ไม่ hardcode ป.1–6)
  - **Auto-fix**: "แก้ในห้องนี้" / "แก้ทุกห้อง" — greedy หา slot ว่างย้ายคาบที่ชนให้อัตโนมัติ
  - **Smart suggestion**: แนะนำ slot ว่างที่ย้ายไปได้โดยไม่ชน
- **ตัวนับคาบ/สัปดาห์** (`ScheduleHoursCounter`): เทียบกับมาตรฐาน สพฐ. ตามระดับชั้น (ป.1–3 vs ป.4–6)
- **คู่มือเริ่มต้น**: กล่องแนะนำ 3 ขั้นตอนตอนเปิดครั้งแรก (ปิดได้, จำใน localStorage)
- Auto-save (debounce 1200ms, บันทึกเฉพาะห้องที่แก้ — dirty set กัน wipe ห้องอื่น)
- Undo (Ctrl+Z / ปุ่มใน toast) — รองรับลบช่อง / ล้างห้อง / ล้างทุกห้อง
- Export PDF (ทุกห้อง หน้าละห้อง + ช่องลายเซ็น)

> **Grade parsing** (`src/lib/grade.ts`): อ่านระดับชั้นจาก**ชื่อห้องก่อน** (เช่น "ป.3/1", "ม.4/4")
> แล้ว fallback ไป `level` — เพราะข้อมูลจริง `level` มักเป็นแค่ "ประถมศึกษา" ไม่มีเลขชั้น
> รองรับ อ./ป./ม. ใช้ร่วมกันทั้งหน้าตารางสอนและตัวนับคาบ

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
│   │   ├── db.ts                 # SQLite client (Web API)
│   │   ├── client-data.ts        # client helpers + runtime detection (Electron vs Web)
│   │   ├── electron.ts           # detect/wrap electronAPI
│   │   ├── grade.ts              # อ่านระดับชั้นจากชื่อห้อง/level (อ./ป./ม.)
│   │   ├── schedule-templates.ts # generate ตาราง + clash detection + suggestion
│   │   └── hooks/                # useAutoSave, useConfirm, useSubjects, useTheme, etc.
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
- [x] ตารางสอน + clash detection + paint mode + auto-fix + สร้างอัตโนมัติ (clash scope 3 แบบ)
- [x] Import/Export Excel (นักเรียน, คะแนน, สุขภาพ)
- [x] Export PDF (ปพ.5, ปพ.6, transcript)
- [x] รายงานเช็คชื่อ
- [x] ระบบค้นหา (Sidebar)
- [x] Auto-backup รายวัน + pre-destructive snapshot
- [x] Promote ห้องเรียน (transaction-safe)
- [x] Security hardening (sandbox, magic bytes, atomic backup)
- [x] Dual data layer sync (Electron IPC + Web API) + runtime fallback ปลอดภัย
- [x] Dark mode + ปรับขนาดฟอนต์ (flat design, สีจาก token ทั้งหมด)
- [x] Build เป็น .exe portable
