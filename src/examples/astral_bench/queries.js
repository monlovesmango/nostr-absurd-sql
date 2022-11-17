if (globalThis.performance == null) {
  globalThis.performance = require('perf_hooks').performance;
}

function uid(i) {
  // This will make ids of different lengths, but we want to inject
  // some larger data than just ints (something like a uuid) but we
  // don't want to actually generate uuids because that's slow-ish and
  // we want profiling to show sqlite as much as possible
  return '0000000000000000000000000' + i;
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

async function clear(db, output = console.log) {
  output('Clearing existing data');
  db.exec(`
    BEGIN TRANSACTION;
    DROP TABLE IF EXISTS nostr;
    COMMIT;
  `);
  create(db, output);
  output('Done');
}
async function create(db, output = console.log) {
  output('creating tables and indexes');
  db.exec(`
    BEGIN TRANSACTION;
    CREATE TABLE IF NOT EXISTS nostr (
      id TEXT PRIMARY KEY,
      relays TEXT NOT NULL,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      temporary BOOLEAN NOT NULL,
      event TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_temporary_first_seen ON nostr (first_seen) WHERE temporary = TRUE;
    CREATE INDEX IF NOT EXISTS idx_kind_created_at ON nostr (json_extract(event,'$.kind'), json_extract(event,'$.created_at'));
    CREATE INDEX IF NOT EXISTS idx_kind_pubkey_created_at ON nostr (json_extract(event,'$.kind'), json_extract(event,'$.pubkey'), json_extract(event,'$.created_at'));
    
    CREATE TABLE IF NOT EXISTS idx_kind_tag_created_at (
      kind INTEGER NOT NULL,
      tag TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      id TEXT NOT NULL,
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
          new.id
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
    COMMIT;`
  );
  output('Done');
}

// CREATE INDEX IF NOT EXISTS idx_kind_tag_created_at ON nostr (json_extract(event,'$.kind'), json_each(json_extract(event,'$.tags')), json_extract(event,'$.created_at'));
// function populate(db, count, output = console.log, outputTiming = console.log) {
//   let start = Date.now();
//   db.exec('BEGIN TRANSACTION');
//   let stmt = db.prepare('INSERT INTO kv (key, value) VALUES (?, ?)');

//   output(`Inserting ${formatNumber(count)} items`);

//   for (let i = 0; i < count; i++) {
//     stmt.run([uid(i), ((Math.random() * 100) | 0).toString()]);
//   }
//   db.exec('COMMIT');
//   let took = Date.now() - start;
//   output('Done! Took: ' + took);
//   outputTiming(took);
// }

function saveEvents(db, events, output = console.log, outputTiming = console.log) {
  let start = Date.now();
  // console.log(`saving ${events.length} events...`)
  function updateRelaysColumn(newList, existingList) {
    let relays = JSON.parse(existingList);
    let relay = JSON.parse(newList)[0]
    if (relays.includes(relay)) return existingList;
    else {
      relays.push(relay)
      return JSON.stringify(relays);
    }
  }
  function firstObjectKey(obj) {
    return Object.keys(JSON.parse(obj))[0]
  }
  // db.create_function('update_relays_column', updateRelaysColumn);
  // db.create_function('first_object_key', firstObjectKey);
  db.exec(`BEGIN TRANSACTION;
  `);
  // db.exec(`BEGIN TRANSACTION;
  // `);
  // let stmt = db.prepare('INSERT INTO kv (key, value) VALUES (?, ?)');

  let stmt = db.prepare(`
  INSERT INTO nostr (id, relays, first_seen, last_seen, temporary, event)
    VALUES(?, ?, strftime('%s', 'now'), strftime('%s', 'now'), ?, ?)
    ON CONFLICT(id) DO UPDATE SET
    relays=relays||" "||excluded.relays,
    last_seen=strftime('%s', 'now')
    WHERE INSTR(relays, excluded.relays) = 0;
    `);
  // relays=relays||","||excluded.relays;
  // relays=json_insert(relays,first_object_key(excluded.relays),true;
  // relays=update_relays_column(excluded.relays,relays);

  // output(`Inserting ${formatNumber(count)} items`);

  // for (let i = 0; i < count; i++) {
  //   stmt.run([uid(i), ((Math.random() * 100) | 0).toString()]);
  // }
  for (let i = 0; i < events.length; i++) {
    let event = events[i].event;
    let relay = events[i].relay;
    stmt.run([event.id, relay, false, JSON.stringify(event)]);
  }
  db.exec('COMMIT');
  stmt.free();
  let took = Date.now() - start;
  output('Done! Took: ' + took + ` for ${events.length} events`);
  // output('events inserted: ' + JSON.stringify(events));
  // outputTiming(took);
}

function sumAll(db, output = console.log, outputTiming = console.log) {
  output('Running <code>SELECT COUNT(*) FROM kv</code>');

  let stmt;
  try {
    stmt = db.prepare(`SELECT SUM(value) FROM kv`);
  } catch (err) {
    output('Error (make sure you write data first): ' + err.message);
    throw err;
  }

  let start = performance.now();
  let row;

  if (stmt.all) {
    let row = stmt.all();
    output(JSON.stringify(row));
  } else {
    while (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
  }

  let took = performance.now() - start;
  output('<code>' + JSON.stringify(row) + '</code>');

  outputTiming(took);
  output('Done reading, took ' + formatNumber(took) + 'ms');
  output('That scanned through all of the data');
}

async function randomReads(
  db,
  output = console.log,
  outputTiming = console.log
) {
  output(
    'Running <code>SELECT key FROM kv LIMIT 1000 OFFSET ?</code> 20 times with increasing offset'
  );
  let start = Date.now();

  let stmt;
  try {
    stmt = db.prepare(`SELECT key FROM kv LIMIT 1000 OFFSET ?`);
  } catch (err) {
    output('Error (make sure you write data first): ' + err.message);
    throw err;
  }

  let canRebind = !!stmt.reset;

  for (let i = 0; i < 20; i++) {
    let off = i * 300;
    if (canRebind) {
      stmt.bind([off]);
    }
    // output('Using offset: ' + formatNumber(off));

    if (stmt.all) {
      // better-sqlite3 doesn't allow you to rebind the same
      // statement. This is probably a tiny perf hit, but negligable
      // for what we're measuring (it's already so much faster anyway)
      stmt = db.prepare(`SELECT key FROM kv LIMIT 2000 OFFSET ${off}`);
      let rows = stmt.all();
      console.log(rows[rows.length - 1]);
    } else {
      let num = 0;
      while (stmt.step()) {
        num++;
        let row = stmt.get();
        if (num === 999) {
          // output('(999 items hidden)');
        } else if (num > 998) {
          // output('<code>' + JSON.stringify(row) + '</code>');
        }
      }
    }

    if (canRebind) {
      stmt.reset();
    }
  }

  if (stmt.free) {
    stmt.free();
  }

  let took = Date.now() - start;
  outputTiming(took);
  output('Done reading, took ' + formatNumber(took) + 'ms');
}

async function query(
  db,
  queryStmt,
  output = console.log,
  outputTiming = console.log
) {
  output(`Running <code>${queryStmt}</code>`);
  // output('Running <code>SELECT COUNT(*) FROM kv</code>');

  // let stmt;
  // try {
  //   stmt = db.prepare(`SELECT SUM(value) FROM kv`);
  // } catch (err) {
  //   output('Error (make sure you write data first): ' + err.message);
  //   throw err;
  // }

  let start = performance.now();
  // let row;
  let results = db.exec(queryStmt)

  // if (stmt.all) {
  //   let row = stmt.all();
  //   output(JSON.stringify(row));
  // } else {
  //   while (stmt.step()) {
  //     row = stmt.getAsObject();
  //   }
  //   stmt.free();
  // }

  let took = performance.now() - start;
  // output('<code>' + JSON.stringify(row) + '</code>');

  outputTiming(took);
  output('Done reading, took ' + formatNumber(took) + 'ms');
  output('That scanned through all of the data');
  return results;
}

module.exports = { clear, create, saveEvents, sumAll, randomReads, query };
// module.exports = { clear, populate, saveEvents, sumAll, randomReads };
