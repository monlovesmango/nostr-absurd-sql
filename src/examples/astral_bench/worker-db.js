import initSqlJs from '@jlongster/sql.js';
import { SQLiteFS } from '../..';
// import MemoryBackend from '../../memory/backend';
import IndexedDBBackend from '../../indexeddb/backend';
// import * as queries from './queries';
// import * as rawIDBQueries from './queries-raw-idb';
import mergebounce from 'mergebounce'
import { matchFilter } from 'nostr-tools';
// import { EventEmitter } from 'events';
// let dbEmitter = new EventEmitter();
// import { dbSave } from './db';
import { query } from './queries';

// Various global state for the demo
let currentBackendType = 'idb';
let cacheSize = 2000;
let pageSize = 8192;
let dbName = `astral.absurd-sql`;
// let recordProfile = false;
// let useRawIDB = false;

// let memoryBackend = new MemoryBackend({});
let idbBackend = new IndexedDBBackend(() => {
  console.error('Unable to write!');
});
let sqlFS;

let db = getDb();
let relayWorker = new Worker(new URL('./worker-relay.js', import.meta.url));
// let relays;

let debouncedDbSave = mergebounce(
  events => saveEventsToDb(events),
  500,
  { 'concatArrays': true, 'promise': true }
);
// relayWorker.addEventListener('message', e => {
relayWorker.onmessage = ev => {
  switch (ev.data.type) {
    case 'event': {
      // consolvlog(e.data);
      debouncedDbSave([ev.data])
      // lastSave = Date.now();
      break;
    }
    default: {
      output(ev.data);
      break;
    }
  }
};

// Helper methods
function output(msg) {
  self.postMessage({ type: 'output', msg });
}

function getPageSize(db) {
  let stmt = db.prepare('PRAGMA page_size');
  stmt.step();
  let row = stmt.getAsObject();
  stmt.free();
  return row.page_size;
}
// instead of creating this function, import dbGetRelayForPubKey from db.js
// function getRelays(pubkey) {
//   let event = queryDb(`
//     SELECT event LIMIT 1
//     FROM nostr
//     WHERE json_extract(event,'$.kind') = 3
//   `)
// }

let SQL = null;
async function init() {
  if (SQL == null) {
    SQL = await initSqlJs({ locateFile: file => file });
    sqlFS = new SQLiteFS(SQL.FS, idbBackend);
    SQL.register_for_idb(sqlFS);

    if (typeof SharedArrayBuffer === 'undefined') {
      output(
        '<code>SharedArrayBuffer</code> is not available in your browser. Falling back.'
      );
    }

    SQL.FS.mkdir('/blocked');
    SQL.FS.mount(sqlFS, {}, '/blocked');
  }
}

function handleInsertedEvent(event) {
  for (let id in streams) {
    if (matchFilter(streams[id].filter, event)) streams[id].callback(event)
  }
}

function createTables(db, output = console.log) {
  output('creating tables and indexes');
  db.create_function('handleInsertedEvent', event => {
    console.log('handleInsertedEvent', event)
    handleInsertedEvent(event)
  })
  db.exec(`
    BEGIN TRANSACTION;
    CREATE TABLE IF NOT EXISTS nostr (
      id TEXT PRIMARY KEY,
      temporary BOOLEAN NOT NULL,
      event TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kind_created_at ON nostr (json_extract(event,'$.kind'), json_extract(event,'$.created_at') DESC);
    CREATE INDEX IF NOT EXISTS idx_kind_pubkey_created_at ON nostr (json_extract(event,'$.kind'), json_extract(event,'$.pubkey'), json_extract(event,'$.created_at') DESC);
    
    CREATE TABLE IF NOT EXISTS idx_kind_tag_created_at (
      kind INTEGER NOT NULL,
      tag TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      id TEXT NOT NULL,
      pubkey TEXT NOT NULL,
      PRIMARY KEY(kind, tag, created_at, id)
      );
    CREATE TRIGGER IF NOT EXISTS nostr_tags_after_insert AFTER INSERT ON nostr 
      WHEN json_array_length(json_extract(new.event,'$.tags')) > 0
      BEGIN
        INSERT OR IGNORE INTO idx_kind_tag_created_at (kind, tag, created_at, id)
        SELECT DISTINCT json_extract(new.event, '$.kind'),
          lower(iif(
            instr(substr(tag.value, instr(tag.value, ',') + 1), ','),
            substr(tag.value, 1, instr(tag.value, ',') + instr(substr(tag.value, instr(tag.value, ',') + 1), ',') - 1)||']',
            tag.value
          )),
          json_extract(new.event, '$.created_at'),
          new.id,
          json_extract(new.event, '$.pubkey')
        FROM json_each(json_extract(new.event, '$.tags')) AS tag;
      END;
    CREATE TRIGGER IF NOT EXISTS nostr_tags_after_delete AFTER DELETE ON nostr 
      WHEN json_array_length(json_extract(old.event,'$.tags')) > 0
      BEGIN
        DELETE FROM idx_kind_tag_created_at
        WHERE kind = json_extract(old.event,'$.kind') AND
          tag in (
            SELECT lower(iif(
                instr(substr(tag.value, instr(tag.value, ',') + 1), ','),
                substr(tag.value, 1, instr(tag.value, ',') + instr(substr(tag.value, instr(tag.value, ',') + 1), ',') - 1)||']',
                tag.value
              ))
            FROM json_each(json_extract(old.event,'$.tags')) AS tag
          ) AND
          created_at = json_extract(old.event,'$.created_at') AND
          id = old.id;
      END;
    CREATE TRIGGER IF NOT EXISTS nostr_after_insert AFTER INSERT ON nostr 
      BEGIN
        SELECT handleInsertedEvent(new.event) AS '';
      END;
    COMMIT;`
  );
  output('Done');
}

async function getDb() {
  await init();
  if (db == null) {
    let path = `/blocked/${dbName}`;

    if (typeof SharedArrayBuffer === 'undefined') {
      let stream = SQL.FS.open(path, 'a+');
      await stream.node.contents.readIfFallback();
      SQL.FS.close(stream);
    }

    let db = new SQL.Database(path, { filename: true });

    // Should ALWAYS use the journal in memory mode. Doesn't make
    // any sense at all to write the journal. It's way slower
    db.exec(`
      PRAGMA cache_size=-${cacheSize};
      PRAGMA journal_mode=MEMORY;
      PRAGMA page_size=${pageSize};
    `);
    output(`Opened ${dbName} (${currentBackendType}) cache size: ${cacheSize}`);
    createTables(db);
  }

  let curPageSize = getPageSize(db);

  if (curPageSize !== pageSize) {
    output('Page size has changed, running VACUUM to restructure db');
    db.exec('VACUUM');
    // Vacuuming resets the cache size, so set it back
    db.exec(`PRAGMA cache_size=-${cacheSize}`);
    output(`Page size is now ${getPageSize(db)}`);
  }

  return db;
}

function queryDb(sql) {
  let stmt = db.prepare(sql);
  let rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows.length === 1 ? rows[0] : rows;
  // self.postMessage({
  //   type: 'query-results',
  //   data: rows,
  //   id: msg.data.id
  // });
}

function closeDb() {
  if (db) {
    output(`Closed db`);
    db.close();
    db = null;
  }
}

function saveEventsToDb(events, output = console.log, outputTiming = console.log) {
  let start = Date.now();
  // console.log(`saving ${events.length} events...`)
  db.exec(`BEGIN TRANSACTION;
  `);

  let stmt = db.prepare(`
  INSERT INTO nostr (id, temporary, event)
    VALUES(?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
    event=json_set(
      event,
      '$.seen_on',json_insert(json_extract(event,'$.seen_on'),'$[#]',json_extract(excluded.event,'$.seen_on[0]')),
      '$.last_seen',json_extract(excluded.event,'$.last_seen')
    )
    WHERE INSTR(json_extract(event,'$.seen_on'), json_extract(excluded.event,'$.seen_on[0]')) = 0;
    `);
  for (let i = 0; i < events.length; i++) {
    let event = events[i].event;
    let relay = events[i].relay;
    event.first_seen = Math.round(Date.now() / 1000);
    event.last_seen = Math.round(Date.now() / 1000);
    event.seen_on = [];
    if (relay) event.seen_on.push(relay);
    event.tags = event.tags.map(tag => tag.map(element => element.toLowerCase()));
    stmt.run([event.id, false, JSON.stringify(event)]);
  }
  db.exec('COMMIT');
  stmt.free();
  let took = Date.now() - start;
  output('Done! Took: ' + took + ` for ${events.length} events`);
  return events;
  // output('events inserted: ' + JSON.stringify(events));
  // outputTiming(took);
}

function setFilter() {
  let compiledSubs = Object.entries(subs)//.filter(([id, value]) => type === 'ids')
    .map(([_, sub]) => sub)
    .reduce((acc, { type, value }) => {
      if (type === 'feed') {
        acc[type] = value;
        return acc
      }
      if (type === 'tag') {
        let tagType = value.tagType;
        let tagValues = value.tagValues;
        acc[`#${tagType}`] = (acc[`#${tagType}`] || []).concat(tagValues)
        return acc
      }
      acc[type] = (acc[type] || []).concat(value);
      return acc
    }, {})
  let filter = Object.entries(compiledSubs)
    .map(([type, value]) => {
      switch (type) {
        case 'profile':
          return {
            authors: value
          }
        case 'profileInfo':
          return {
            authors: value,
            kinds: [0, 3]
          }
        case 'feed':
          return {
            since: value
          }
        case 'event':
          return {
            ids: value
          }
        default:
          return {
            [type]: value
          }
      }
    })
  relayWorker.postMessage({ type: 'setFilter', filter })
}

function cancelSub(id) {
  delete subs[id]
  if (Object.keys(subs).length === 0) relayWorker.postMessage({ type: 'unsub' })
  else setFilter()
}

const methods = {
  // delete everything
  //
  async eraseDb() {
    // return await db.destroy()
    await init();
    closeDb();

    let filepath = `/blocked/${dbName}`;

    let exists = true;
    try {
      SQL.FS.stat(filepath);
    } catch (e) {
      exists = false;
    }

    if (exists) {
      SQL.FS.unlink(filepath);
    }
    db = null;
    return
  },

  dbSave(event) {
    let events = [{ event }];
    saveEventsToDb(events)
    return event
  },

  async dbGetHomeFeedNotes(since = Math.round(Date.now() / 1000)) {
    let result = queryDb(`
      SELECT event
      FROM nostr
      WHERE json_extract(event,'$.kind') = 1
      AND json_extract(event,'$.created_at') > ${since}
    `)
    return result
  },

  onNewHomeFeedNote(since = Math.round(Date.now() / 1000), callback = () => { }) {
    return {
      filter: {
        kinds: [1, 2],
        since
      },
      callback
    }
  },

  async dbGetChats(pubkey) {
    let result = queryDb(`
      SELECT tag, pubkey, MAX(created_at)
      FROM idx_kind_tag_created_at
      WHERE kind = 4
      GROUP BY tag, pubkey
    `);

    let chats = result.map(row => {
      return {
        peer: row.tag[1] === pubkey ? row.pubkey : row.tag[1],
        date: row.created_at
      }
    })
      .reduce((acc, { peer, date }) => {
        acc[peer] = acc[peer] || 0
        if (date > acc[peer]) acc[peer] = date
        return acc
      }, {})

    // let chatsOld = result.rows
    //   .map(r => r.key)
    //   .reduce((acc, [peer, date]) => {
    //     acc[peer] = acc[peer] || 0
    //     if (date > acc[peer]) acc[peer] = date
    //     return acc
    //   }, {})

    // delete chats[pubkey]

    return Object.entries(chats)
      .sort((a, b) => b[1] - a[1])
      .map(([peer, lastMessage]) => ({ peer, lastMessage }))
  },

  async dbGetMessages(
    peerPubKey,
    limit = 50,
    since = Math.round(Date.now() / 1000)
  ) {
    let result = await db.query('main/messages', {
      include_docs: true,
      descending: true,
      startkey: [peerPubKey, since],
      endkey: [peerPubKey, 0],
      limit
    })
    return result.rows
      .map(r => r.doc)
      .reverse()
      .reduce((acc, event) => {
        if (!acc.length) return [event]
        let last = acc[acc.length - 1]
        if (
          last.pubkey === event.pubkey &&
          last.created_at + 120 >= event.created_at
        ) {
          last.appended = last.appended || []
          last.appended.push(event)
        } else {
          acc.push(event)
        }
        return acc
      }, [])
  },

  onNewMessage(peerPubKey, callback = () => { }) {
    // listen for changes
    let changes = db.changes({
      live: true,
      since: 'now',
      include_docs: true,
      filter: '_view',
      view: 'main/messages'
    })

    changes.on('change', change => {
      if (
        change.doc.pubkey === peerPubKey ||
        change.doc.tags.find(([t, v]) => t === 'p' && v === peerPubKey)
      ) {
        callback(change.doc)
      }
    })

    return changes
  },

  async dbGetEvent(id) {
    try {
      return await db.get(id)
    } catch (err) {
      if (err.name === 'not_found') return null
      else throw err
    }
  },

  onEventUpdate(id, callback = () => { }) {
    let changes = db.changes({
      live: true,
      since: 'now',
      include_docs: true,
      doc_ids: [id]
    })

    changes.on('change', change => callback(change.doc))

    return changes
  },

  async dbGetMentions(ourPubKey, limit = 40, since, until) {
    let result = await db.query('main/mentions', {
      include_docs: true,
      descending: true,
      startkey: [ourPubKey, until],
      endkey: [ourPubKey, since],
      limit
    })
    return result.rows.map(r => r.doc)
  },

  onNewMention(ourPubKey, callback = () => { }) {
    // listen for changes
    let changes = db.changes({
      live: true,
      since: 'now',
      include_docs: true,
      filter: '_view',
      view: 'main/mentions'
    })

    changes.on('change', change => {
      if (change.doc.tags.find(([t, v]) => t === 'p' && v === ourPubKey)) {
        callback(change.doc)
      }
    })

    return changes
  },

  onNewAnyMessage(callback = () => { }) {
    // listen for changes
    let changes = db.changes({
      live: true,
      since: 'now',
      include_docs: true,
      filter: '_view',
      view: 'main/messages'
    })

    changes.on('change', change => {
      callback(change.doc)
    })

    return changes
  },

  async dbGetUnreadNotificationsCount(ourPubKey, since) {
    let result = await db.query('main/mentions', {
      include_docs: false,
      descending: true,
      startkey: [ourPubKey, {}],
      endkey: [ourPubKey, since]
    })
    return result.rows.filter((v, i, a) => a.indexOf(v) === i).length
  },

  async dbGetUnreadMessages(pubkey, since) {
    let result = await db.query('main/messages', {
      include_docs: true,
      descending: true,
      startkey: [pubkey, {}],
      endkey: [pubkey, since]
    })
    return result.rows.filter(r => r.doc.pubkey === pubkey).length
  },

  async dbGetProfile(pubkey) {
    let result = await db.query('main/profiles', {
      include_docs: true,
      key: pubkey
    })
    switch (result.rows.length) {
      case 0:
        return null
      case 1:
        return result.rows[0].doc
      default: {
        let sorted = result.rows.sort(
          (a, b) => (b.doc?.created_at || 0) - (a.doc?.created_at || 0)
        )
        sorted
          .slice(1)
          .filter(row => row.doc)
          .forEach(row => db.remove(row.doc))
        return sorted[0].doc
      }
    }
  },

  async dbGetContactList(pubkey) {
    let result = await db.query('main/contactlists', {
      include_docs: true,
      key: pubkey
    })
    switch (result.rows.length) {
      case 0:
        return null
      case 1:
        return result.rows[0].doc
      default: {
        let sorted = result.rows.sort(
          (a, b) => (b.doc?.created_at || 0) - (a.doc?.created_at || 0)
        )
        sorted
          .slice(1)
          .filter(row => row.doc)
          .forEach(row => db.remove(row.doc))
        return sorted[0].doc
      }
    }
  },

  relayUnsub() {
    relayWorker.postMessage({ type: 'unsub' })
    return
  },

  setRelays(relays) {
    relayWorker.postMessage({ type: 'setRelays', relays })
  },

  relaySubProfile(pubkey) {
    let pubkeys = Array.isArray(pubkey) ? pubkey : [pubkey]
    return {
      type: 'profile',
      value: pubkeys
    }
  },

  relaySubProfileInfo(pubkey) {
    let pubkeys = Array.isArray(pubkey) ? pubkey : [pubkey]
    return {
      type: 'profileInfo',
      value: pubkeys
    }
  },

  relaySubTag(type, value) {
    let values = Array.isArray(value) ? value : [value];
    return {
      type: 'tag',
      value: {
        tagType: type,
        tagValues: values
      }
    }
  },

  relaySubFeed(since) {
    return {
      type: 'feed',
      value: since
    }
  },

  relaySubEvent(id) {
    let ids = Array.isArray(id) ? ids : [id];
    return {
      type: 'event',
      value: ids
    }
  }
}

var streams = {}
var subs = {}

self.onmessage = async function (ev) {
  let { name, args, id, stream, cancel, sub } = JSON.parse(ev.data)

  if (sub && cancel) {
    // subs[id].cancel()
    // delete subs[id]
    cancelSub(id)
  } else if (sub) {
    subs[id] = methods[name](...args);
    setFilter()
  } else if (stream) {
    let changes = methods[name](...args, event => {
      self.postMessage(
        JSON.stringify({
          id,
          event,
          stream: true
        })
      )
    })
    streams[id] = changes
  } else if (cancel) {
    // streams[id].cancel()
    delete streams[id]
  } else {
    var reply = { id }
    try {
      let data = await methods[name](...args)
      reply.success = true
      reply.data = data
    } catch (err) {
      reply.success = false
      reply.error = err.message
    }

    self.postMessage(JSON.stringify(reply))
  }
}