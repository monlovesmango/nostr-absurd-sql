import { initBackend } from '../../indexeddb/main-thread';
import { listenForPerfData } from 'perf-deets/frontend';
import { JSONEditor } from '@json-editor/json-editor'
import { boolean, func } from 'fast-check';

let worker;

const defaultFilters = [
  {
    ids: ['7ad2193380208900e760f07eaddbd02bb50c24443a7b96ed88dabb7b8e8925e2']
  }
  // {
  //   authors: [
  //     "22e804d26ed16b68db5259e78449e96dab5d464c8f470bda3eb1a70467f2c793"
  //   ],
  //   kinds: [
  //     "1"
  //   ]
  // },
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
    'wss://nostr-pub.wellorder.net',
    // 'wss://expensive-relay.fiatjaf.com',
    // 'wss://nostr.rocks',
    // 'wss://relayer.fiatjaf.com',
    // 'wss://nostr.onsats.org',
    'wss://nostr-relay.untethr.me',
    'wss://nostr-relay.wlvs.space',
    'wss://nostr.bitcoiner.social',
    'wss://nostr-relay.freeberty.net',
    'wss://nostr.oxtr.dev',
    'wss://relay.damus.io',
    'wss://nostr.semisol.dev'
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
