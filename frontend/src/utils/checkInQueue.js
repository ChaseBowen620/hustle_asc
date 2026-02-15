/**
 * Client-side queue for pending attendances and new students.
 * Flush runs 1 hour after each event's time (per event).
 * Store: localStorage key hustle_checkin_queue.
 * Structure: { attendances: [...], students: [...] }
 * - attendances: { studentId (number or tempId string), eventId, eventDate (ISO), tempId }
 * - students: { first_name, last_name, a_number, tempId } (password generated at flush)
 */

import { isFlushDueForEvent } from './mstDate'

const STORAGE_KEY = 'hustle_checkin_queue'

const defaultStore = () => ({ attendances: [], students: [] })

export function getQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultStore()
    const data = JSON.parse(raw)
    return {
      attendances: Array.isArray(data.attendances) ? data.attendances : [],
      students: Array.isArray(data.students) ? data.students : [],
    }
  } catch {
    return defaultStore()
  }
}

function setQueue(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/** Clear the local queue (e.g. after server flush). */
export function clearQueue() {
  setQueue(defaultStore())
}

export function addPendingAttendance({ studentId, eventId, eventDate, tempId }) {
  const store = getQueue()
  store.attendances.push({ studentId, eventId, eventDate, tempId: tempId || `att-${Date.now()}-${Math.random().toString(36).slice(2)}` })
  setQueue(store)
  return store.attendances[store.attendances.length - 1].tempId
}

export function addPendingStudent({ first_name, last_name, a_number, tempId }) {
  const store = getQueue()
  const id = tempId || `stu-${Date.now()}-${Math.random().toString(36).slice(2)}`
  store.students.push({ first_name, last_name, a_number, tempId: id })
  setQueue(store)
  return id
}

export function removePendingAttendancesByTempIds(tempIds) {
  const store = getQueue()
  store.attendances = store.attendances.filter((a) => !tempIds.includes(a.tempId))
  setQueue(store)
}

export function removePendingStudentsByTempIds(tempIds) {
  const store = getQueue()
  store.students = store.students.filter((s) => !tempIds.includes(s.tempId))
  setQueue(store)
}

/**
 * Remove one pending attendance by tempId. If the student was only referenced by this
 * attendance (tempId string), also remove that pending student from the queue.
 */
export function removePendingAttendanceByTempId(attendanceTempId) {
  const store = getQueue()
  const att = store.attendances.find((a) => a.tempId === attendanceTempId)
  if (!att) return
  const studentTempId = typeof att.studentId === 'string' ? att.studentId : null
  store.attendances = store.attendances.filter((a) => a.tempId !== attendanceTempId)
  if (studentTempId && !store.attendances.some((a) => a.studentId === studentTempId)) {
    store.students = store.students.filter((s) => s.tempId !== studentTempId)
  }
  setQueue(store)
}

/**
 * Get unique event IDs that have pending attendances and are due for flush.
 */
export function getEventIdsDueForFlush() {
  const store = getQueue()
  const eventDates = {}
  store.attendances.forEach((a) => {
    if (!eventDates[a.eventId]) eventDates[a.eventId] = a.eventDate
  })
  const due = []
  Object.keys(eventDates).forEach((eventId) => {
    if (isFlushDueForEvent(eventDates[eventId])) due.push(Number(eventId))
  })
  return due
}

/**
 * Flush one event: create all new students referenced by tempIds, then create all attendances.
 * Returns { flushedAttendanceTempIds, flushedStudentTempIds }.
 */
export async function flushEvent(eventId, apiUrl, registerPayload = {}) {
  const store = getQueue()
  const eventAttendances = store.attendances.filter((a) => Number(a.eventId) === Number(eventId))
  if (eventAttendances.length === 0) return { flushedAttendanceTempIds: [], flushedStudentTempIds: [] }

  const tempStudentIds = new Set()
  eventAttendances.forEach((a) => {
    if (typeof a.studentId === 'string' && a.studentId.startsWith('stu-')) tempStudentIds.add(a.studentId)
  })

  const tempIdToRealId = {}

  for (const tempId of tempStudentIds) {
    const pending = store.students.find((s) => s.tempId === tempId)
    if (!pending) continue
    const body = {
      first_name: pending.first_name,
      last_name: pending.last_name,
      a_number: pending.a_number,
    }
    if (registerPayload[tempId]?.password) body.password = registerPayload[tempId].password
    const res = await fetch(`${apiUrl}/api/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err.error || ''
      // If A-number already exists, resolve to existing student so other attendances can still sync
      if (msg.includes('A-number already exists') || msg.includes('already exists')) {
        const listRes = await fetch(`${apiUrl}/api/students/`)
        const list = await listRes.json()
        const arr = Array.isArray(list) ? list : (list.results || list.data || [])
        const student = arr.find((s) => (s.username || (s.user && s.user.username) || '').toLowerCase() === (pending.a_number || '').toLowerCase())
        if (student) {
          tempIdToRealId[tempId] = student.id
          continue
        }
      }
      throw new Error(msg || `Register failed for ${pending.a_number}`)
    }
    const data = await res.json()
    if (data.student_id != null) tempIdToRealId[tempId] = data.student_id
    else {
      const listRes = await fetch(`${apiUrl}/api/students/`)
      const list = await listRes.json()
      const arr = Array.isArray(list) ? list : (list.results || list.data || [])
      const student = arr.find((s) => (s.username || (s.user && s.user.username) || '').toLowerCase() === (pending.a_number || '').toLowerCase())
      if (student) tempIdToRealId[tempId] = student.id
    }
  }

  const flushedAttendanceTempIds = []
  for (const att of eventAttendances) {
    const studentId = typeof att.studentId === 'number' ? att.studentId : tempIdToRealId[att.studentId]
    if (studentId == null) continue
    const res = await fetch(`${apiUrl}/api/attendance/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student: studentId, event: eventId }),
    })
    if (res.ok) flushedAttendanceTempIds.push(att.tempId)
    else {
      const err = await res.json().catch(() => ({}))
      if (err.error !== 'Student already checked in') throw new Error(err.error || 'Attendance create failed')
      flushedAttendanceTempIds.push(att.tempId)
    }
  }

  const flushedStudentTempIds = [...tempStudentIds]

  store.attendances = store.attendances.filter((a) => !flushedAttendanceTempIds.includes(a.tempId))
  store.students = store.students.filter((s) => !flushedStudentTempIds.includes(s.tempId))
  setQueue(store)

  return { flushedAttendanceTempIds, flushedStudentTempIds }
}

/**
 * Get all unique event IDs that have pending attendances (regardless of due time).
 */
export function getAllEventIdsWithPending() {
  const store = getQueue()
  const ids = new Set()
  store.attendances.forEach((a) => ids.add(Number(a.eventId)))
  return Array.from(ids)
}

/**
 * Run flush for all events that are due. Call periodically (e.g. every minute).
 */
export async function runFlushDue(apiUrl, onFlushError) {
  const eventIds = getEventIdsDueForFlush()
  for (const eventId of eventIds) {
    try {
      await flushEvent(eventId, apiUrl)
    } catch (err) {
      onFlushError && onFlushError(eventId, err)
    }
  }
}

/**
 * Flush all pending account creations and attendances to the system (all events with pending data).
 */
export async function runFlushAll(apiUrl, onFlushError) {
  const eventIds = getAllEventIdsWithPending()
  for (const eventId of eventIds) {
    try {
      await flushEvent(eventId, apiUrl)
    } catch (err) {
      onFlushError && onFlushError(eventId, err)
    }
  }
}

/**
 * Sync one pending check-in to the server (so Refresh Attendances works across devices e.g. scan on phone).
 * Payload: { temp_id, event_id, event_date?, student_id? } or { temp_id, event_id, event_date?, first_name, last_name, a_number }.
 */
export async function addPendingCheckInToServer(apiUrl, payload) {
  const res = await fetch(`${apiUrl}/api/attendance/pending/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to sync pending (${res.status})`)
  }
}

/**
 * Remove one pending check-in from the server by temp_id.
 */
export async function removePendingCheckInFromServer(apiUrl, tempId) {
  const res = await fetch(`${apiUrl}/api/attendance/pending/${encodeURIComponent(tempId)}/`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to remove pending (${res.status})`)
  }
}

/**
 * Flush all pending check-ins on the server (creates students and attendances). Returns { flushed, attendances, students_created }.
 */
export async function flushPendingCheckInsOnServer(apiUrl) {
  const res = await fetch(`${apiUrl}/api/attendance/flush-pending/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to flush pending (${res.status})`)
  }
  return res.json()
}
