import { initBackend } from '../../indexeddb/main-thread';
import { listenForPerfData } from 'perf-deets/frontend';
import { JSONEditor } from '@json-editor/json-editor'
import { boolean, func } from 'fast-check';
// import CodeMirror from 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.58.1/codemirror.js'
// import(/* webpackIgnore: true */ "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.58.1/codemirror.js");

let worker;

const defaultFilters = [
  // {
  //   ids: ['7ad2193380208900e760f07eaddbd02bb50c24443a7b96ed88dabb7b8e8925e2']
  // }
  {
    authors: [
      "8c0da4862130283ff9e67d889df264177a508974e2feb96de139804ea66d6168"
    ],
    kinds: [
      0, 3
    ]
  }
  // {
  //   authors: [
  //     "8c0da4862130283ff9e67d889df264177a508974e2feb96de139804ea66d6168",
  //     "2df69cd0c6ab95e08f466abe7b39bb64e744ee31ffc3041f270bdfec2a37ec06",
  //     "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  //     "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
  //     "9ec7a778167afb1d30c4833de9322da0c08ba71a69e1911d5578d3144bb56437",
  //     "b238e136091cb01cd21606dac1a2f503f504e7e8e7c75d98fcefd30aed084a1c",
  //     "4557aab9aae76a892e01568064a9e262e613690421a79e584b8cc4c5ca9afb7e",
  //     "52b4a076bcbbbdc3a1aefa3735816cf74993b1b8db202b01c883c58be7fad8bd",
  //     "9682c33f9024dadb1bffdf762c3156e26b4aa340de8d06c91ca537fcc0fdb3a9",
  //     "b2d670de53b27691c0c3400225b65c35a26d06093bcc41f48ffc71e0907f9d4a",
  //     "2ef93f01cd2493e04235a6b87b10d3c4a74e2a7eb7c3caf168268f6af73314b5",
  //     "46fcbe3065eaf1ae7811465924e48923363ff3f526bd6f73d7c184b16bd8ce4d",
  //     "d543c820050efd6d2c1536b0990111ac293a4431e6a12929432366e0aa8001e7",
  //     "bb1cf5250435ff475cd8b32acb23e3ee7bbe8fc38f6951704b4798513947672c",
  //     "6b0d4c8d9dc59e110d380b0429a02891f1341a0fa2ba1b1cf83a3db4d47e3964",
  //     "04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9",
  //     "ed1d0e1f743a7d19aa2dfb0162df73bacdbc699f67cc55bb91a98c35f7deac69",
  //     "e9e4276490374a0daf7759fd5f475deff6ffb9b0fc5fa98c902b5f4b2fe3bba2",
  //     "22e804d26ed16b68db5259e78449e96dab5d464c8f470bda3eb1a70467f2c793",
  //     "35d26e4690cbe1a898af61cc3515661eb5fa763b57bd0b42e45099c8b32fd50f",
  //     "aff9a9f017f32b2e8b60754a4102db9d9cf9ff2b967804b50e070780aa45c9a8",
  //     "8ba2a6b558eeb7fccd1862b905ae9d9408cfbc208f1680d1262733246e92d4da",
  //     "4570d7a0b49b5524797120810116a2a5c18281423b173a557056f08f15c5382d",
  //     "1265c1c3d41f0f05bf306224ec40628231a5086a2eaa36643b3982a4eba19c9f",
  //     "b1dd5e8ed19644671e8693ca2445c68729249f6d4f2d2d8f072d5e1399ba7ecb",
  //     "d4d4fdde8ab4924b1e452e896709a3bd236da4c0576274b52af5992d4d34762c",
  //     "0e2bdefddef247c4001f27765a96813895063d2ac6ca2a934c3a3d995c913b33",
  //     "dcecb5c4c228e15a1f04305c34b39b7ff67675544cb7dc74dd5c715cf62ada74",
  //     "d7b76d02c758a62a505e03bd5f5049aaee4e7e36283d273c7f6798912692df2b",
  //     "d91191e30e00444b942c0e82cad470b32af171764c2275bee0bd99377efd4075",
  //     "373ebe3d45ec91977296a178d9f19f326c70631d2a1b0bbba5c5ecc2eb53b9e7",
  //     "f676b30d7bfd90669bdb90fb9158c56a008912c7761e20d117e83aef90709491",
  //     "b0635d6a9851d3aed0cd6c495b282167acf761729078d975fc341b22650b07b9",
  //     "1fa91680ebfc68069ec13423fc8b9b0a746e9265584e16cf7d80be7ad721de6e",
  //     "50c603ef273f6dd1cdd7c4a89dd59279b917e073b5d982d8b2f18845cf19d769",
  //   ],
  //   "kinds": [
  //     0,
  //     1,
  //     3
  //   ]
  // }
  // {
  //   "authors": [
  //     "2df69cd0c6ab95e08f466abe7b39bb64e744ee31ffc3041f270bdfec2a37ec06"
  //   ],
  //   "kinds": [
  //     "0"
  //   ]
  // }
  // notes, profiles and contact lists of people we follow (and ourselves)
  // {
  //   kinds: [0, 1, 2, 3],
  //   authors: ['8c0da4862130283ff9e67d889df264177a508974e2feb96de139804ea66d6168']
  //   // authors: store.state.following.concat(store.state.keys.pub)
  // },

  // // posts mentioning us and direct messages to us
  // {
  //   kinds: [1, 4],
  //   '#p': ['8c0da4862130283ff9e67d889df264177a508974e2feb96de139804ea66d6168']
  // },

  // our own direct messages to other people
  // {
  //   kinds: [4],
  //   authors: ['8c0da4862130283ff9e67d889df264177a508974e2feb96de139804ea66d6168']
  // }
]
var filterSchema = {
  type: "object",
  properties: {
    ids: {
      type: "array",
      format: "table",
      items: {
        type: "string",
      }
    },
    authors: {
      type: "array",
      format: "table",
      items: {
        type: "string"
      }
    },
    kinds: {
      type: "array",
      uniqueItems: true,
      items: {
        type: "string",
        enum: ["0", "1", "2", "3", "4", "5"],
        options: {
          enum: [
            { title: "0 - metadata" },
            { title: "1 - text" },
            { title: "2 - relay" },
            { title: "3 - contacts" },
            { title: "4 - encrypted dm" },
            { title: "5 - event deletion" }
          ]
        }
      }
    },
    since: {
      type: "integer",
      format: "datetime-local",
      options: {
        inputAttributes: {
          placeholder: "Enter datetime"
        },
        flatpickr: {
          enableSeconds: true,
          defaultHour: 0,
          defaultMinute: 0,
          defaultSecond: 0,
          wrap: true,
          time_24hr: true,
          allowInput: true
        }
      }
    },
    until: {
      type: "integer",
      format: "datetime-local",
      options: {
        inputAttributes: {
          placeholder: "Enter datetime"
        },
        flatpickr: {
          enableSeconds: true,
          defaultHour: 0,
          defaultMinute: 0,
          defaultSecond: 0,
          wrap: true,
          time_24hr: true,
          allowInput: true
        }
      }
    },
    '#p': {
      type: 'array',
      format: 'table',
      items: {
        type: 'string'
      }
    },
    '#e': {
      type: 'array',
      format: 'table',
      items: {
        type: 'string'
      }
    },
    '#hashtag': {
      type: 'array',
      format: 'table',
      items: {
        type: 'string'
      }
    },
  },
  defaultProperties: ['ids', 'authors', 'kinds', 'since', 'until']
};

var relaySchema = {
  type: "array",
  uniqueItems: true,
  format: 'checkbox',
  items: {
    type: "string",
    enum: [
      'wss://rsslay.fiatjaf.com',
      'wss://nostr-pub.wellorder.net',
      'wss://expensive-relay.fiatjaf.com',
      'wss://nostr.rocks',
      'wss://relayer.fiatjaf.com',
      'wss://nostr.onsats.org',
      'wss://nostr-relay.untethr.me',
      'wss://nostr-relay.wlvs.space',
      'wss://nostr.bitcoiner.social',
      'wss://nostr-relay.freeberty.net',
      'wss://nostr.oxtr.dev',
      'wss://relay.damus.io',
      'wss://nostr.semisol.dev'
    ]
  }
}
let filterOptions = {
  schema: filterSchema,
  theme: 'bootstrap4',
  template: "handlebars",
  form_name_root: 'filter',
  iconlib: 'fontawesome5',
  remove_button_lables: true,
  prompt_before_delete: false,
  disable_array_delete_last_row: true,
  disable_array_reorder: true,
  object_layout: 'normal',
  disable_collapse: true,
  show_opt_in: true,
  max_depth: 2,
};
let relayOptions = {
  schema: relaySchema,
  disable_edit_json: true,
  theme: 'bootstrap4',
  form_name_root: 'relays',
  startval: [
    // 'wss://rsslay.fiatjaf.com',
    // 'wss://nostr-pub.wellorder.net',
    'wss://expensive-relay.fiatjaf.com',
    // 'wss://nostr.rocks',
    // 'wss://relayer.fiatjaf.com',
    // 'wss://nostr.onsats.org',
    // 'wss://nostr-relay.untethr.me',
    // 'wss://nostr-relay.wlvs.space',
    // 'wss://nostr.bitcoiner.social',
    // 'wss://nostr-relay.freeberty.net',
    // 'wss://nostr.oxtr.dev',
    // 'wss://relay.damus.io',
    // 'wss://nostr.semisol.dev'
  ],
  iconlib: 'fontawesome5',
  remove_button_lables: true,
  prompt_before_delete: false,
  disable_array_delete_last_row: true,
  disable_array_reorder: true
};


let filterEditor = []
let relayEditor = new JSONEditor(document.getElementById('relay_editor'), relayOptions);

let filterTextarea = document.querySelector('#filter-textarea')
let relayTextarea = document.querySelector('#relay-textarea')
let setFilters = document.querySelector('#setfilters')
let setRelays = document.querySelector('#setrelays')

relayEditor.on('change', () => {
  relayTextarea.value = JSON.stringify(relayEditor.getValue(), null, 2);
  document.getElementById('updateSubscriptionRelays').disabled = false;
})

setFilters.addEventListener('click', () => {
  let filters = JSON.parse(filterTextarea.value);
  deleteAllFilters()
  let filterEditors = document.getElementById('filter_editors');
  filterEditor = filters.map((filter, index) => createFilterEditor(filterEditors, index, filter));
})
setRelays.addEventListener('click', () => {
  relayEditor.setValue(JSON.parse(relayTextarea.value))
})

function createFilterEditor(node, index, filter) {
  let options = Object.assign({}, filterOptions);
  options.form_name_root = `filter-${index + 1}`;
  options.startval = filter;
  let div = document.createElement('div')
  div.setAttribute('id', `filter-${index + 1}_editor`)
  div.setAttribute('class', `filter_editor`)
  let editor = new JSONEditor(div, options)
  node.appendChild(div)
  // let editor = new JSONEditor(document.getElementById(`filter-${index + 1}_editor`), options)
  editor.on('ready', () => {
    let controls = div.querySelector(`.je-object__controls`)
    controls.appendChild(createDeleteFilterButton(index))
  });
  editor.on('change', () => {
    let filters = filterEditor.map(editor => editor.getValue())
    filters.forEach(filter => {
      if (filter.kinds) filter.kinds = filter.kinds.map(kind => Number(kind))
    })
    filterTextarea.value = JSON.stringify(filters, null, 2);
    document.getElementById('updateSubscriptionFilters').disabled = false;
  })
  return editor
}

function createDeleteFilterButton(index) {
  let button = document.createElement('button');
  button.setAttribute('id', `delete_filter-${index + 1}_button`)
  button.setAttribute('value', `${index}`)
  button.setAttribute('class', `filter_delete_button btn btn-secondary btn-sm json-editor-btn-delete delete json-editor-btntype-delete`)
  let icon = document.createElement('i');
  icon.setAttribute('class', 'fas fa-trash')
  button.appendChild(icon)
  button.addEventListener('click', () => {
    let index = button.getAttribute('value');
    deleteFilter(index)
  });
  return button
}

function deleteAllFilters() {
  filterEditor.forEach(editor => editor.destroy())
  for (let editorNode of document.querySelectorAll('.filter_editor')) {
    editorNode.remove()
  }
  filterEditor = []
}

function deleteFilter(index) {
  let [deletedEditor] = filterEditor.splice(index, 1);
  deletedEditor.destroy()
  let tempFilters = filterEditor.map(editor => editor.getValue())
  deleteAllFilters()
  let filterEditors = document.getElementById('filter_editors');
  filterEditor = tempFilters.map((filter, index) => createFilterEditor(filterEditors, index, filter));
}


function fixed(num, places) {
  let factor = Math.pow(10, places);
  let clipped = (num * factor) | 0;
  return clipped / factor;
}

function output(msg) {
  let outputEl = document.querySelector('.output');
  let el = document.createElement('div');
  el.innerHTML = msg;
  outputEl.append(el);
  outputEl.scrollTop = 100000;
}

function clearTimings() {
  document.querySelector('.timings-data').innerHTML = '';
}

function outputTiming(timing) {
  let div = document.createElement('div');
  div.textContent = fixed(timing, 2).toString();
  document.querySelector('.timings-data').appendChild(div);
}

var execBtn = document.getElementById("execute");
var outputElm = document.getElementById('output');
var errorElm = document.getElementById('error');
var commandsElm = document.getElementById('commands');
var dbFileElm = document.getElementById('dbfile');
var savedbElm = document.getElementById('savedb');


// Connect to the HTML element we 'print' to
function print(text) {
  outputElm.innerHTML = text.replace(/\n/g, '<br>');
}
function error(e) {
  console.log(e);
  errorElm.style.height = '2em';
  errorElm.textContent = e.message;
}

function noerror() {
  errorElm.style.height = '0';
}

// Run a command in the database
function execute(commands) {
  tic();

  worker.postMessage({ type: 'run-query', sql: commands });
  outputElm.textContent = "Fetching results...";
}

// Create an HTML table
var tableCreate = function () {
  function valconcat(vals, tagName) {
    if (vals.length === 0) return '';
    var open = '<' + tagName + '>', close = '</' + tagName + '>';
    return open + vals.join(close + open) + close;
  }
  return function (data) {
    if (data.length === 0) return;
    console.log(data)
    let columns = Object.keys(data[0]);
    let values = data.map(row => Object.values(row));
    console.log('columns:', columns, 'values:', values)
    var tbl = document.createElement('table');
    var html = '<thead>' + valconcat(columns, 'th') + '</thead>';
    var rows = values.map(function (v) { return valconcat(v, 'td'); });
    html += '<tbody>' + valconcat(rows, 'tr') + '</tbody>';
    tbl.innerHTML = html;
    return tbl;
  }
}();

// Execute the commands when the button is clicked
function execEditorContents() {
  console.log('editor.getValue()', editor.getValue())
  noerror()
  execute(editor.getValue() + ';');
}
execBtn.addEventListener("click", execEditorContents, true);

// Performance measurement functions
var tictime;
if (!window.performance || !performance.now) { window.performance = { now: Date.now } }
function tic() { tictime = performance.now() }
function toc(msg) {
  var dt = performance.now() - tictime;
  console.log((msg || 'toc') + ": " + dt + "ms");
}

// Add syntax highlihjting to the textarea
var editor = CodeMirror.fromTextArea(commandsElm, {
  mode: 'text/x-mysql',
  viewportMargin: Infinity,
  indentWithTabs: true,
  smartIndent: true,
  lineNumbers: true,
  matchBrackets: true,
  autofocus: true,
  extraKeys: {
    "Ctrl-Enter": execEditorContents,
    // "Ctrl-S": savedb,
  }
});

function init() {
  worker = new Worker(new URL('./main.worker.js', import.meta.url));
  initBackend(worker);
  listenForPerfData(worker);

  worker.postMessage({ type: 'ui-invoke', name: 'init' });

  worker.addEventListener('message', e => {
    switch (e.data.type) {
      case 'output': {
        output(e.data.msg);
        break;
      }
      case 'clearTimings': {
        clearTimings();
        break;
      }
      case 'outputTiming': {
        outputTiming(e.data.timing);
        break;
      }
      case 'query-results': {
        // worker.onmessage = function (event) {
        var results = e.data.data;
        toc("Executing SQL");
        if (!results) {
          output({ error: e.data.error });
          return;
        }

        tic();
        outputElm.innerHTML = "";
        if (!results.length) {
          print('0 rows returned');
          break;
        }
        outputElm.appendChild(tableCreate(results))
        // for (var i = 0; i < results.length; i++) {
        //   let result = results[i]
        //   outputElm.appendChild(tableCreate(result));
        //   // outputElm.appendChild(tableCreate(Object.keys(row), [Object.values(row)]));
        // }
        console.log(results);
        toc("Displaying results");
        // }
        break;
      }
    }
  });

  // let more = document.querySelector('.more');
  // let moreText = document.querySelector('.more-text');
  // moreText.addEventListener('click', () => {
  //   moreText.style.display = 'none';
  //   more.style.display = 'inline';
  // });




  if (Array.isArray(defaultFilters) && defaultFilters.length) {
    let filterEditors = document.getElementById('filter_editors')
    filterEditor = defaultFilters.map((filter, index) => createFilterEditor(filterEditors, index, filter));
  }

  let filterEditors = document.getElementById('filter_editors')
  let addFilter = document.getElementById('add_filter_button');
  addFilter.addEventListener('click', () => {
    let index = filterEditor.length
    filterEditor[index] = createFilterEditor(filterEditors, index)
  });
  let deleteFilters = document.getElementById('delete_filters_button');
  deleteFilters.addEventListener('click', () => {
    deleteAllFilters()
  });
  let updateSubscriptionFilters = document.getElementById('updateSubscriptionFilters');
  updateSubscriptionFilters.addEventListener('click', () => {
    worker.postMessage({
      type: 'ui-invoke',
      name: 'updateSubscriptionFilters',
      filters: filterEditor.map(editor => editor.getValue()),
      relays: relayEditor.getValue()
    })
    document.getElementById('updateSubscriptionFilters').disabled = true;
  })
  let updateSubscriptionRelays = document.getElementById('updateSubscriptionRelays');
  updateSubscriptionRelays.addEventListener('click', () => {
    worker.postMessage({
      type: 'ui-invoke',
      name: 'updateSubscriptionRelays',
      filters: filterEditor.map(editor => editor.getValue()),
      relays: relayEditor.getValue()
    })
    document.getElementById('updateSubscriptionRelays').disabled = true;
  })
  let unsubscribe = document.getElementById('unsubscribe');
  unsubscribe.addEventListener('click', () => {
    worker.postMessage({
      type: 'ui-invoke',
      name: 'unsubscribe',
      filters: filterEditor.map(editor => editor.getValue()),
      relays: relayEditor.getValue()
    })
  })

  for (let input of document.querySelectorAll('input[type=radio]')) {
    input.addEventListener('change', e => {
      let name = e.target.name;
      let value = e.target.value;
      worker.postMessage({ type: 'options', name, value });
    });
  }

  // Make sure all inputs reflect the initial state (browsers try to
  // be smart and keep the state from before)
  document.querySelector('input[name="backend"][value="idb"]').checked = true;
  document.querySelector('input[name="cacheSize"][value="0"]').checked = true;
  document.querySelector('input[name="pageSize"][value="4096"]').checked = true;

  let profile = document.querySelector('input[name="profile"]');
  profile.addEventListener('click', e => {
    worker.postMessage({ type: 'profiling', on: e.target.checked });
  });
  worker.postMessage({ type: 'profiling', on: profile.checked });

  let rawIDB = document.querySelector('input[name="raw-indexeddb"]');
  rawIDB.addEventListener('click', e => {
    document.querySelector('.disable-if-raw-idb').style.opacity = e.target
      .checked
      ? 0.3
      : 1;
    worker.postMessage({
      type: 'options',
      name: 'raw-idb',
      on: e.target.checked
    });
  });
  worker.postMessage({
    type: 'options',
    name: 'raw-idb',
    on: rawIDB.checked
  });
}

let methods = [
  'init',
  'populateSmall',
  'populateLarge',
  'populateFromRelay',
  'sumAll',
  'randomReads',
  'deleteFile',
  'readBench',
  'writeBench'
];

for (let method of methods) {
  let btn = document.querySelector(`#${method}`);
  if (btn) {
    btn.addEventListener('click', () => {
      // let filters = JSON.parse(JSON.stringify(filterEditor.map(editor => editor.getValue())));
      let filters = filterEditor.map(editor => editor.getValue());
      filters.forEach(filter => {
        if (filter.kinds) filter.kinds = filter.kinds.map(kind => Number(kind))
      })
      let relays = relayEditor.getValue().map(relay => relay.trim());

      console.log({ type: 'ui-invoke', name: method, filters, relays })
      worker.postMessage({ type: 'ui-invoke', name: method, filters, relays })
      document.getElementById('unsubscribe').disabled = false;

    }
    );
  }
}

init();

window.runQuery = sql => {
  let reqId = Math.random();

  let promise = new Promise(resolve => {
    let handler = e => {
      if (e.data.type === 'query-results' && e.data.id === reqId) {
        worker.removeEventListener('message', handler);
        resolve(e.data.data);
      }
    };
    worker.addEventListener('message', handler);
  });

  worker.postMessage({ type: 'run-query', sql, id: reqId });
  return promise;
};
