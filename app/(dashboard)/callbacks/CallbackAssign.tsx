'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Employee = { id: string; name: string }

export default function CallbackAssign({
  callbackId,
  employeeId,
  employees,
}: {
  callbackId: string
  employeeId: string | null
  employees: Employee[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const current = employees.find(e => e.id === employeeId)

  async function assign(empId: string | null) {
    setAssigning(true)
    await fetch('/api/callbacks/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callbackId, employeeId: empId }),
    })
    setOpen(false)
    setAssigning(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-left text-sm w-full group"
      >
        {current
          ? <span className="text-slate-700 group-hover:text-yellow-600 transition">{current.name}</span>
          : <span className="text-slate-400 group-hover:text-yellow-600 transition">未割当</span>
        }
        <span className="text-slate-300 ml-1 text-xs">▼</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-32 bg-white border border-slate-200 rounded-lg shadow-sm p-1">
      <button
        onClick={() => assign(null)}
        disabled={assigning}
        className={`text-left text-xs px-2 py-1.5 rounded transition ${
          !employeeId ? 'bg-slate-100 text-slate-500' : 'text-slate-400 hover:bg-slate-50'
        }`}
      >
        未割当
      </button>
      {employees.map(emp => (
        <button
          key={emp.id}
          onClick={() => assign(emp.id)}
          disabled={assigning}
          className={`text-left text-xs px-2 py-1.5 rounded transition ${
            emp.id === employeeId
              ? 'bg-yellow-100 text-yellow-800 font-medium'
              : 'text-slate-700 hover:bg-slate-50'
          }`}
        >
          {emp.name}
        </button>
      ))}
      <button
        onClick={() => setOpen(false)}
        className="text-left text-xs px-2 py-1.5 text-slate-300 hover:text-slate-500 transition mt-0.5 border-t border-slate-100"
      >
        閉じる
      </button>
    </div>
  )
}
