import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { updateStudentPhotoPath } from '@/lib/db'

function getPhotosDir() {
  const dir = path.join(process.cwd(), 'photos')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * POST: upload student photo (multipart/form-data)
 * Fields: studentId (string), file (File)
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const studentIdRaw = formData.get('studentId')
    const file = formData.get('file') as File | null

    if (!studentIdRaw || !file) {
      return NextResponse.json({ error: 'Missing studentId or file' }, { status: 400 })
    }

    const studentId = Number(studentIdRaw)
    const buf = Buffer.from(await file.arrayBuffer())

    // กำหนด ext จาก file name หรือ mime type
    let ext = 'jpg'
    const nameExt = (file as File).name?.split('.').pop()?.toLowerCase()
    if (nameExt && /^[a-z0-9]{1,5}$/.test(nameExt)) ext = nameExt
    else if (file.type.includes('png')) ext = 'png'
    else if (file.type.includes('gif')) ext = 'gif'

    const dir = getPhotosDir()
    const fileName = `${studentId}.${ext}`
    const fullPath = path.join(dir, fileName)
    fs.writeFileSync(fullPath, buf)

    updateStudentPhotoPath(studentId, fileName)

    return NextResponse.json({ success: true, photo_path: fileName })
  } catch (error) {
    console.error('[API] POST /api/students/photo', error)
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 })
  }
}

/**
 * DELETE: remove student photo
 * Query: ?studentId=<id>
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = Number(searchParams.get('studentId'))
    if (!studentId) {
      return NextResponse.json({ error: 'Missing studentId' }, { status: 400 })
    }

    const dir = getPhotosDir()
    // ลบไฟล์รูปทุก ext ที่อาจมี
    for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp']) {
      const p = path.join(dir, `${studentId}.${ext}`)
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p)
        } catch {
          // ignore
        }
      }
    }

    updateStudentPhotoPath(studentId, null)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] DELETE /api/students/photo', error)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
}

/**
 * GET: serve photo as data URL
 * Query: ?path=<filename>
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const photoPath = searchParams.get('path')
    if (!photoPath) {
      return NextResponse.json({ dataUrl: null })
    }
    const safe = path.basename(photoPath)
    const fullPath = path.join(getPhotosDir(), safe)
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ dataUrl: null })
    }
    const ext = path.extname(safe).slice(1).toLowerCase() || 'jpeg'
    const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
    const buf = fs.readFileSync(fullPath)
    return NextResponse.json({ dataUrl: `data:${mime};base64,${buf.toString('base64')}` })
  } catch (error) {
    console.error('[API] GET /api/students/photo', error)
    return NextResponse.json({ dataUrl: null })
  }
}
