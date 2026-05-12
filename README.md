# ระบบจัดการชั้นเรียนและนักเรียน

ระบบจัดการห้องเรียนแบบออฟไลน์สำหรับครูประจำชั้น — เช็คชื่อ บันทึกคะแนน สุขภาพ และตารางสอน ทำงานบนเครื่องครูโดยไม่ต้องเชื่อมต่ออินเทอร์เน็ต

## ฟีเจอร์

- จัดการห้องเรียนและนักเรียน (รวมรูปประจำตัว)
- เช็คชื่อรายวันพร้อม auto-save และ keyboard navigation
- บันทึกคะแนนกลางภาค + ปลายภาค + คำนวณเกรดอัตโนมัติ
- บันทึกน้ำหนัก/ส่วนสูง + คำนวณ BMI
- ตารางสอนแบบ paint mode + ตรวจคาบซ้ำข้ามห้อง
- Transcript รายบุคคล (PDF)
- Import/Export Excel ทุกข้อมูลหลัก
- Auto-backup รายวัน + snapshot ก่อนการกระทำที่อันตราย
- Promote นักเรียนขึ้นชั้นพร้อม archive ห้องเดิม (atomic)
- ระบบ trash + auto-purge 30 วัน

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 18 + TypeScript 5
- **UI**: Tailwind CSS 3 + lucide-react
- **Desktop**: Electron 33 + electron-builder
- **Database**: SQLite (better-sqlite3) — WAL mode, FK ON
- **Forms**: React Hook Form + Zod
- **State**: Zustand
- **Export**: xlsx, jspdf, jspdf-autotable

## การติดตั้ง

```bash
npm install
```

ครั้งแรกที่ติดตั้งบนเครื่องใหม่ `better-sqlite3` อาจ rebuild native binary สำหรับ Electron — ใช้เวลาสักครู่

## การรัน

### Development (Web + Electron พร้อมกัน)
```bash
npm run electron:dev
```
จะเปิด Next.js dev server (http://localhost:3000) แล้ว Electron จะ load หน้าจาก localhost

### Development (Web mode เฉย ๆ)
```bash
npm run dev
```
เปิดเบราว์เซอร์ที่ http://localhost:3000 — ใช้สำหรับทดสอบ UI โดยไม่ต้องเปิด Electron

### Production Build
```bash
npm run build:electron
```
ผลลัพธ์อยู่ที่ `dist/School Management System.exe` (Windows portable build)

## โครงสร้างโปรเจกต์

```
electron/
  main.js              Electron main process + IPC + DB
  preload.js           ContextBridge API
src/
  app/                 Next.js App Router
    api/               Web API routes (dev mode)
    students/          จัดการนักเรียน
    attendance/        เช็คชื่อ + รายงาน
    grades/            คะแนน (midterm + final)
    health/            บันทึกสุขภาพ
    schedule/          ตารางสอน
    report-card/       Transcript
    export-excel/      Export รวม
    settings/          ตั้งค่า + backup
  components/          React components
  lib/
    db.ts              SQLite client สำหรับ Web API
    client-data.ts     Client helpers (auto-detect Electron vs Web)
    electron.ts        Wrapper สำหรับ window.electronAPI
    hooks/             useAutoSave, useConfirm, useSubjects, ...
  types/               TypeScript types
public/                Static assets
SPEC.md                Specification
TEST_CASE.md           Test cases
```

## สถาปัตยกรรม Dual Data Layer

ระบบมี data layer 2 ชุดที่ทำงานสลับกันตาม mode:

| Mode | Renderer เรียกผ่าน | DB Path |
|------|----------------------|---------|
| **Electron (prod)** | `window.electronAPI.*` (IPC) | `app.getPath('userData')/school.db` |
| **Web (dev)** | `fetch('/api/...')` | `process.cwd()/school.db` |

ทั้งสอง layer **ต้อง sync schema และ API contract ให้ตรงกันเสมอ** — `src/lib/db.ts` (Web) และ `electron/main.js` (Electron) เป็น source of truth คู่กัน

## Database Location

| ระบบปฏิบัติการ | Path |
|---|---|
| Windows | `%APPDATA%\school-system\school.db` |
| macOS | `~/Library/Application Support/school-system/school.db` |
| Dev mode | `<project>/school.db` |

Override ได้ผ่าน env var `SCHOOL_DB_PATH`

## Backup

- **Daily auto-backup**: เก็บใน `<userData>/backups/school_<date>.db` (เก็บ 30 ไฟล์ล่าสุด)
- **Manual snapshot**: ก่อน restore, clear-all, import จะสร้าง snapshot อัตโนมัติ
- **Atomic**: ทำ `wal_checkpoint(FULL)` ก่อน copy file ทุกครั้ง

## Security

- Electron `contextIsolation`, `sandbox`, `webSecurity` เปิดทั้งหมด
- Preload ใช้ `contextBridge` whitelist API
- รูปนักเรียน: จำกัด 5MB + verify magic bytes (jpg/png/gif/webp)
- SQL ใช้ prepared statements ทุก query
- External URL ส่งไป default browser ผ่าน `setWindowOpenHandler`

## เอกสารเพิ่มเติม

- `SPEC.md` — Full specification + schema + design system
- `TEST_CASE.md` — Test cases

## License

Private project — ใช้ภายในโรงเรียน
