import { Check, Clock, UserCheck, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../api'
import { useToast } from '../../context'
import { btn } from '../../lib/styles'

// Connect / Requested / Accept / Friends, kept in sync with the server.
// `student` needs { id, name, friendship, friendRequestId }.
export default function FriendButton({ student, onChange, compact = false }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const size = compact ? 'px-4 py-2 text-xs' : ''

  async function run(fn, next, message) {
    setBusy(true)
    try {
      const result = await fn()
      onChange?.({ ...next, ...(result || {}) })
      if (message) toast(message)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  switch (student.friendship) {
    case 'friends':
      return (
        <span className={`${btn.ghost} ${size} pointer-events-none text-emerald-500`}>
          <UserCheck size={16} /> Friends
        </span>
      )
    case 'request_sent':
      return (
        <button
          disabled={busy}
          onClick={() =>
            run(() => api(`/friends/requests/${student.friendRequestId}/cancel`, { method: 'POST' }), { friendship: 'none', friendRequestId: undefined }, 'Request cancelled.')
          }
          className={`${btn.ghost} ${size}`}
          title="Cancel request"
        >
          <Clock size={16} className="text-amber-500" /> Requested
        </button>
      )
    case 'request_received':
      return (
        <span className="inline-flex gap-2">
          <button
            disabled={busy}
            onClick={() =>
              run(() => api(`/friends/requests/${student.friendRequestId}/accept`, { method: 'POST' }), { friendship: 'friends', friendRequestId: undefined }, `You and ${student.name} are now friends.`)
            }
            className={`${btn.primary} ${size}`}
          >
            <Check size={16} /> Accept
          </button>
          <button
            disabled={busy}
            onClick={() => run(() => api(`/friends/requests/${student.friendRequestId}/reject`, { method: 'POST' }), { friendship: 'none', friendRequestId: undefined })}
            className={btn.icon}
            aria-label={`Decline ${student.name}'s request`}
            title="Decline"
          >
            <X size={16} />
          </button>
        </span>
      )
    default:
      return (
        <button
          disabled={busy}
          onClick={() =>
            run(
              async () => {
                const { request } = await api('/friends/requests', { method: 'POST', body: { userId: student.id } })
                return request.status === 'accepted'
                  ? { friendship: 'friends', friendRequestId: undefined }
                  : { friendship: 'request_sent', friendRequestId: request.id }
              },
              {},
              'Friend request sent.',
            )
          }
          className={`${btn.primary} ${size}`}
        >
          <UserPlus size={16} /> Connect
        </button>
      )
  }
}
