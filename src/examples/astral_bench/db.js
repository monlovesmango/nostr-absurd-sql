const worker = new Worker(new URL('./worker-db.js', import.meta.url))

const hub = {}

worker.onmessage = ev => {
  let { id, success, error, data, stream } = JSON.parse(ev.data)

  if (stream) {
    console.debug('🖴', id, '~>>', data)
    hub[id](data)
    return
  }

  if (!success) {
    hub[id].reject(new Error(error))
    delete hub[id]
    return
  }

  if (data) console.debug('🖴', id, '->', data)
  hub[id]?.resolve?.(data)
  delete hub[id]
}

function call(name, args) {
  let id = name + ' ' + Math.random().toString().slice(-4)
  console.debug('🖴', id, '<-', args)
  worker.postMessage(JSON.stringify({ id, name, args }))
  return new Promise((resolve, reject) => {
    hub[id] = { resolve, reject }
  })
}

function stream(name, args, callback) {
  let id = name + ' ' + Math.random().toString().slice(-4)
  hub[id] = callback
  console.debug('db <-', id, args)
  worker.postMessage(JSON.stringify({ id, name, args, stream: true }))
  return {
    cancel() {
      worker.postMessage(JSON.stringify({ id, cancel: true }))
    }
  }
}

function sub(name, args) {
  let id = name + ' ' + Math.random().toString().slice(-4)
  // hub[id] = callback
  console.debug('relay sub', id, args)
  worker.postMessage(JSON.stringify({ id, name, args, sub: true }))
  return {
    update(...args) {
      worker.postMessage(JSON.stringify({ id, name, args, sub: true }))
    },
    cancel() {
      worker.postMessage(JSON.stringify({ id, sub: true, cancel: true }))
    }
  }
}

export async function eraseDatabase() {
  return call('eraseDatabase', [])
}
export async function dbSave(event) {
  return call('dbSave', [event])
}
export async function dbGetHomeFeedNotes(
  since = Math.round(Date.now() / 1000)
) {
  return call('dbGetHomeFeedNotes', [since])
}
export function onNewHomeFeedNote(
  since = Math.round(Date.now() / 1000),
  callback = () => { }
) {
  return stream('onNewHomeFeedNote', [since], callback)
}
export async function dbGetChats(pubkey) {
  return call('dbGetChats', [pubkey])
}
export async function dbGetMessages(
  peerPubKey,
  limit = 50,
  since = Math.round(Date.now() / 1000)
) {
  return call('dbGetMessages', [peerPubKey, limit, since])
}
export function onNewMessage(peerPubKey, callback = () => { }) {
  return stream('onNewMessage', [peerPubKey], callback)
}
export async function dbGetEvent(id) {
  return call('dbGetEvent', [id])
}
export async function onEventUpdate(id, callback = () => { }) {
  return stream('onEventUpdate', [id], callback)
}
export async function dbGetMentions(pubkey, limit = 40, since, until) {
  return call('dbGetMentions', [pubkey, limit, since, until])
}
export function onNewMention(pubkey, callback = () => { }) {
  return stream('onNewMention', [pubkey], callback)
}
export function onNewAnyMessage(callback = () => { }) {
  return stream('onNewAnyMessage', [], callback)
}
export async function dbGetUnreadNotificationsCount(pubkey, since) {
  return call('dbGetUnreadNotificationsCount', [pubkey, since])
}
export async function dbGetUnreadMessages(pubkey, since) {
  return call('dbGetUnreadMessages', [pubkey, since])
}
export async function dbGetProfile(pubkey) {
  return call('dbGetProfile', [pubkey])
}
export async function dbGetContactList(pubkey) {
  return call('dbGetContactList', [pubkey])
}
export async function dbGetRelayForPubKey(pubkey) {
  return call('dbGetRelayForPubKey', [pubkey])
}
export function relaySubProfile(pubkey) {
  return sub('relaySubProfile', [pubkey])
}
export function relaySubProfileInfo(pubkey) {
  return sub('relaySubProfileInfo', [pubkey])
}
export function relaySubTag(type, value) {
  return sub('relaySubTag', [type, value])
}
export function relaySubFeed(since) {
  return sub('relaySubFeed', [since])
}
export function relaySubEvent(id) {
  return sub('relaySubEvent', [id])
}
export function relayUnsub() {
  return call('relayUnsub', [])
}
export function setRelays(relays) {
  return call('setRelays', [relays])
}