// Elements
const MEDIA_MAPS = '/media/maps/';
let socket;
let user = {
  name: '',
  role: 'user',
  id: '',
  preset: [{
    used: false,
    dice: [],
    counter: 0
  }, {
    used: false,
    dice: [],
    counter: 0
  }]
};
const usersColor = {};
const logContainerHeight = 90;
let showDice = true;
let shareDice = true;
let shareMap = true;
let initialized = false;
let diceType = 'd4';
let selectedDice = null;
const dieAnimationTime = {
  min: 1000,
  max: 3000,
  get(die) {
    const i = (parseInt(die.id, 36) + die.time) % (this.max - this.min);
    return  i + this.min;
  }
};
const diceOverlay = `
<div class="row" id="dice-overlay">
<button class="btn btn-danger" id="dice-overlay-remove" type="button" onclick="removeDice()">
  <span class="oi" data-glyph="x"></span>
</button>
<div id="dice-overlay-glow"></div>
<button class="btn btn-warning" id="dice-overlay-roll" type="button" onclick="rollDice(true)">
  <span class="oi" data-glyph="random"></span>
</button>
</div>`;
const diceColor = {
  d4: '#3366FF', d6: '#FFFF00', d8: '#008000',
  d10: '#FF0000', d12: '#FF9900', d20: '#993366'
};

function showAlert(data) {
  const out = { kick: true, alert: '' };
  if (typeof data.kick != 'undefined') {
    out.kick = data.kick;
  }
  if (typeof data.alert == 'undefined') {
    out.alert = data;
  } else {
    out.alert = data.alert;
  }

  if (out.kick) {
    alert(`${out.alert}, returning to index`);
    //setTimeout(function() { Will be needed when alert moved to modal
      window.location.href = '/';
    //}, 2500);
  } else {
    alert(out.alert);
  }
}

// Needed to ensure that socket messages are sent
// TODO: Determine why additional .send is required after .emit
function refreshSocket() { socket.send(''); }

function userData(data) {
  user = data;

  if (!initialized) {
    if (user.role === 'admin') {
      // Load textures
      $.getJSON(`${MEDIA_MAPS}textures/textures.json`, data => {
        $.each(data, (key, val) => {
          $('#texture-type').append(`
            <input type="radio" id="texture-${val[0]}" name="texture-type" value="${val[0]}" onclick="setPaint('texture', ${val[0]});" />
            <label for="texture-${val[0]}" style="background: url('${MEDIA_MAPS}textures/${val[2]}') 50% 50%;">${val[1]}</label>`);
        });

        // Select first texture type
        $('#texture-type input:radio:first').attr('checked', true);
      });

      // Load walls
      $.getJSON(`${MEDIA_MAPS}walls/walls.json`, data => {
        $.each(data, (key, val) => {
          $('#wall-containers').append(`
    <div class="wall-container col-3 text-center" onclick="mapP5.setSpecificMode('wall', ${val[0]}); $('#tools-modal').modal('toggle');">
      <img class="row mx-auto" src="${MEDIA_MAPS}walls/${val[2]}" />
      <span class="mx-auto">${val[1]}</span>
    </div>`);
        });
      });

      // Load assets
      $.getJSON(`${MEDIA_MAPS}assets/assets.json`, data => {
        $.each(data, (key, val) => {
          $('#asset-containers').append(`
    <div class="asset-container col-3 text-center" onclick="mapP5.setSpecificMode('asset', ${val[0]}); $('#assets-modal').modal('toggle');">
      <img class="row mx-auto" src="${MEDIA_MAPS}assets/${val[2]}" />
      <span class="mx-auto">${val[1]}</span>
    </div>`);
        });
      });
    }

    // Load entities
    $.getJSON(`${MEDIA_MAPS}entities/entities.json`, data => {
      $.each(data, (key, val) => {
        $('#entity-containers').append(`
  <div class="entity-container col-3 text-center" onclick="mapP5.setSpecificMode('entity', ${val[0]}); $('#entities-modal').modal('toggle');">
    <img class="row mx-auto" src="${MEDIA_MAPS}entities/${val[2]}" />
    <span class="mx-auto">${val[1]}</span>
  </div>`);
      });
    });

    // Set user color
    usersColor[user.id] = user.color;

    // Update color wheel in tool menu
    const userColor = getUserColor(user);
    const colorValue = (userColor[0] << 16) + (userColor[1] << 8) + userColor[2];
    const colorString = colorValue.toString(16).padStart(6, '0');
    document.getElementById('color-wheel').value = `#${colorString}`;

    socket.emit('get-room', { id: ROOM_ID }); refreshSocket();
    initialized = true;
  }

  // Load presets
  for (let i = 0; i < user.preset.length; ++i) {
    const preset = user.preset[i];
    if (preset.used) {
      let presetContent = '';

      if (preset.counter !== 0) {
        presetContent += `<h6 class="col-12"><span class="bg-`;
        presetContent += (preset.counter > 0) ? 'success' : 'danger';
        presetContent += `" style="border-radius: 5%;">Counter: ${preset.counter}</span></h6>`;
      }

      presetContent += `
<div class="preset-dice d-flex flex-wrap justify-content-center mx-auto">`;

      preset.dice.forEach(die => {
        presetContent += `
<div class="${die.type} small-die"></div>`;
      });

      presetContent += `</div>`;

      $(`#preset${i + 1}-container`).html(presetContent);
    }
  }
}

function getMap() {
  if (DEBUG) console.log('checking for map');
  // Check if map is fully loaded
  if (typeof mapP5 !== 'undefined' &&
      mapP5.isLoaded()) {
    if (DEBUG) console.log('updating map');
    socket.emit('get-map', { id: ROOM_ID }); refreshSocket();
    $('#map .loader').remove();
    $('#map canvas').show();
    windowResize();
  } else {
    // Wait a second to check if loaded
    setTimeout(getMap, 1000);
  }
}

function removeUser(data) {
  if (user.role === 'admin' || user.name === data) {
    if (DEBUG) console.log(`removing user ${data}`);
    socket.emit('remove-user', { id: ROOM_ID, name: data }); refreshSocket();
  }
}

// Map
function toggleShareMap(val, share = true) {
  if (val !== null && user.role === 'admin') {
    const shareButton = $('#share-map');
    const shareStatus = $('#share-map-status');
    const mapDiv = $('#map');
    shareMap = val;

    if (shareMap) { // Shown
      shareButton.removeClass('btn-danger');
      shareButton.addClass('btn-warning');
      shareStatus.text('Hide');
      mapDiv.css('border-color', 'grey');
    } else { // Hidden
      shareButton.removeClass('btn-warning');
      shareButton.addClass('btn-danger');
      shareStatus.text('Show');
      mapDiv.css('border-color', 'red');
    }

    if (share) {
      socket.emit('share-map', { id: ROOM_ID, share: shareMap }); refreshSocket();
    }
  }
}

function saveMap() {
  const data = `text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(mapP5.saveAll()))}`;
  const a = document.createElement('a');
  a.href = `data:${data}`;
  a.download = 'mapData.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Admin only
function loadMap() {
  if (user.role !== 'admin') return;

  let input, fr;

  if (typeof window.FileReader !== 'function') {
    if (DEBUG) console.log("The file API is not supported on the browser");
    return;
  }

  input = document.getElementById('map-data-input');
  if (!input) {
    if (DEBUG) console.log("Couldn't find the map data element.");
  } else if (!input.files) {
    if (DEBUG) console.log("files property not supported");
  } else if (!input.files[0]) {
    showAlert({ kick: false, alert: "Please select a file before clicking 'Load'" });
  } else {
    file = input.files[0];
    fr = new FileReader();
    fr.onload = e => {
      const lines = e.target.result;
      const newMapData = JSON.parse(lines);
      newMapData.share = shareMap;
      mapP5.loadAll(newMapData);
      sendMap();
    };
    fr.readAsText(file); // calls fr.onload
  }
}

function sendMap() {
  if (user.role !== 'admin') return;

  if (DEBUG) console.log('sending map');
  socket.emit('update-map', {
    id: ROOM_ID,
    map: mapP5.saveAll()
  }); refreshSocket();
}

function mapData(data) {
  if (DEBUG) console.log('receiving map');

  toggleShareMap(data.share, false);
  mapP5.loadAll(data);
}

// Send a type
function send(type) {
  switch (type) {
    case 'walls':
    case 'assets':
    case 'texture':
    case 'fog':
      if (user.role != 'admin') { console.log('not admin'); return; }

    case 'entities':
    case 'lines':
      if (DEBUG) console.log(`sending ${type}`);
      socket.emit('update-map-type', {
        id: ROOM_ID,
        type,
        data: mapP5.saveType(type)
      }); refreshSocket();
      break;
  }
}

// Receive a type
function receive(data) {
  switch (data.type) {
    case 'walls':
    case 'entities':
    case 'assets':
    case 'lines':
    case 'texture':
    case 'fog':
      if (DEBUG) console.log(`receiving ${data.type}`);
      mapP5.loadType(data.type, data.data);
      break;
  }
}

// Dice
function toggleDice(val) {
  const dice = $('#dice-content');
  const map = $('#map-content');

  if (val === null) {
    dice.show();
    map.show();
  } else {
    const toggleStatus = $('#toggle-dice-status');
    showDice = val;

    if (showDice) {
      map.hide();
      dice.show();
      toggleStatus.html('Map');
    } else {
      dice.hide();
      map.show();
      // Resize map
      mapP5.resize();
      toggleStatus.html('Dice');
    }
  }
}

function toggleShareDice(val) {
  if (val !== null) {
    const shareStatus = $('#share-dice-status');
    const userDice = $(`#${user.id}-dice`);
    shareDice = val;
    user.share = shareDice; // TODO: Directly modify user.share from val; remove shareDice

    if (shareDice) { // Shown
      shareStatus.attr('data-glyph', 'lock-unlocked');
    } else { // Hidden
      shareStatus.attr('data-glyph', 'lock-locked');
    }

    socket.emit('share-dice', { id: ROOM_ID, share: shareDice }); refreshSocket();
  }
}

function setDiceType(type) {
  diceType = type;
  $('#dice-type').text(type);
}

function addDice(data) {
  if (DEBUG) console.log(`adding ${data}`);
  socket.emit('add-dice', { id: ROOM_ID, type: data }); refreshSocket();
}

function removeDice(data = null) {
  let out;

  if (data == null && selectedDice !== null) {
    out = { id: ROOM_ID, die: selectedDice.id };
  } else {
    out = { id: ROOM_ID, type: data };
  }

  if (DEBUG) console.log(`removing ${data}`);
  socket.emit('remove-dice', out); refreshSocket();
}

function clearDice() {
  if (DEBUG) console.log('clearing');
  socket.emit('clear-dice', { id: ROOM_ID }); refreshSocket();
}

function rollDice(data = null) {
  let out = null;

  if (data === null) {
    out = { id: ROOM_ID };
  } else if (selectedDice !== null) {
    out = { id: ROOM_ID, die: selectedDice.id };
  }

  if (out !== null) {
    if (DEBUG) console.log('rolling');
    socket.emit('roll-dice', out); refreshSocket();
  }
}

function statusDice(dice, type, counter) {
  let changed = false;
  if (type === 'total') {
    let total = 0;
    for (let i = 0, len = dice.length; i < len; ++i) {
      const die = dice[i];
      changed = true;
      if (die.value > -1) {
        total += die.value;
      }
    }
    if (changed) {
      let out = `<div class="total-label text-center mx-auto p-0"><span class="mx-auto">Total: ${total}`;
      if (counter !== 0) {
        out += ` (${total + counter})`;
      }
      return `${out}</span></div>`;
    }
  } else {
    let num = 0;
    let total = 0;
    for (let i = 0, len = dice.length; i < len; ++i) {
      const die = dice[i];
      if (die.type === type) {
        changed = true;
        num++;
        if (die.value > -1) {
          total += die.value;
        }
      }
    }
    if (changed) {
      return `<div class="${type}-label col-6 col-md-4 col-lg-3 col-xl-2 text-center p-0"><span>${num}${type}:${total}</span></div>`;
    }
  }
  return '';
}

function diceAnimation(animate, time) {
  animate.forEach(die => {
    const dieDiv = $(`#${die.id}-die`);
    const delta = time - die.time;
    const animationTime = dieAnimationTime.get(die);

    // TODO: is this needed
    if (delta > animationTime) return;

    // CSS dice rolling animation
    dieDiv.attr('style', dieAnimation(delta, animationTime, die.value));

    if (die.value === -1) return;

    const start = new Date().getTime();
    const setint = setInterval(() => {
      const prog = new Date().getTime() - start + delta;

      if (prog > animationTime) {
        let dieValue = die.value;
        if (die.type === 'd10' && dieValue === 10) dieValue = 0; // Display 10 on d10 as 0

        dieDiv.find('span.die-number').text(dieValue);
        clearInterval(setint);
      } else {
        const i = Math.min(
          die.anime.length,
          Math.floor(
            die.anime.length *
            Math.sqrt(prog / animationTime)
          )
        );

        let dieValue = die.anime[i];
        if (die.type === 'd10' && dieValue === 10) dieValue = 0; // Display 10 on d10 as 0

        dieDiv.find('span.die-number').text(dieValue);
      }
    }, 10);
  });
}

function dieAnimation(delta, full, value) {
  if (delta > full) {
    return '';
  }
  const df = full/1000; // seconds
  const dd = delta/1000; // seconds

  let out;
  if (value === -1) {
    out = `animation-name: glow; animation-timing-function: ease-out; animation-duration: ${df}s; animation-delay: -${dd}s;`;
  } else {
    out = `animation-name: shake, glow; animation-timing-function: cubic-bezier(0,1,0,1), ease-out; animation-duration: ${df}s, ${df}s; animation-delay: -${dd}s, -${dd}s;`;
  }
  return out;
}

function counter(counter, name = user.name) {
  socket.emit('counter', { id: ROOM_ID, counter, name }); refreshSocket();
}

function preset(load, set) { // Save = 0, Load = 1
  if (load < 0 || load > 1) return;
  if (set < 0 || set > 1) return;

  socket.emit('preset', { id: ROOM_ID, type: load, preset: set }); refreshSocket();
}

function setUserColor(colorString) {
  // Confirm input is a color
  const s = new Option().style;
  s.color = colorString;
  if (s.color !== '') {
    usersColor[user.id] = colorToArray(s.color);

    if (DEBUG) console.log(`changing user color ${usersColor[user.id]}`);
    socket.emit('change-color', { id: ROOM_ID, color: usersColor[user.id] }); refreshSocket();
  }

  // Update color wheel in tool menu
  const userColor = getUserColor(user);
  const colorValue = (userColor[0] << 16) + (userColor[1] << 8) + userColor[2];
  colorString = colorValue.toString(16).padStart(6, '0');
  document.getElementById('color-wheel').value = `#${colorString}`;
}

function getUserColor(aUser) {
  let aUserID = 'nobody';

  if (typeof aUser === 'object') {
    aUserID = aUser.id;
  } else if (typeof aUser === 'string') {
    aUserID = aUser;
  }

  if (usersColor.hasOwnProperty(aUserID)) {
    if (typeof usersColor[aUserID] !== 'undefined') {
      return usersColor[aUserID];
    }

    // Delete undefined color
    delete usersColor[aUser.id];
  }

  // Colors should be provided by the server
  return colorFromString(aUserID);
}

function colorFromString(str) {
  let hash = 5381;
  let i = str.length;

  while(i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }
  hash = hash >>> 0;

  const out = [
    (((hash & 0xFF000000) >> 24) % 8) * 32,
    (((hash & 0x00FF0000) >> 16) % 8) * 32,
    (((hash & 0x0000FF00) >> 8) % 8) * 32
  ];

  return out;
}

function colorToArray(colorString) {
  if (!colorString) {
    return;
  }

  let out = [0, 0, 0];

  const regex = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/;
  if (regex.test(colorString)) {
    const outString = colorString.match(regex);
    out = [
      parseInt(outString[1]),
      parseInt(outString[2]),
      parseInt(outString[3])
    ];
  }

  return out;
}

function setBrushSize(val) {
  $('#brush-size-label').text(val);
  mapP5.setBrushSize(val);
}

function setBrushBlend(val) {
  $('#brush-blend-label').text(val);
  mapP5.setBrushBlend(val);
}

// Window dependant
function roomData(data) {
  if (DEBUG) console.log('updating room');
  $('#dice .loader').remove();

  const diceCount = { d4: 0, d6: 0, d8: 0, d10: 0, d12:0, d20:0 };
  let diceCountChanged = false;

  // Get list of existing user areas
  let existingUsers = [];
  $('#dice > .user-area').each(function() {
    existingUsers.push($(this).data('user-id'));
  });
  for (let i = 0, len = data.users.length; i < len; i++) {
    const aUser = data.users[i];
    let changed = false;

    // Remove from existing users list; user still exists
    existingUsers = existingUsers.filter(e_id => {
      return e_id !== aUser.id;
    });

    // Get user dice area
    const aUserDiceID = `#${aUser.id}-dice`;
    if ($(aUserDiceID).length === 0) { // New user or user dice div is missing
      changed = true;
      if (DEBUG) console.log(`adding missing user dice ${aUser.name}`);
    } else if ($(aUserDiceID).data('updated') !== aUser.updated) { // Existing user dice needs to be updated
      changed = true;
      if (DEBUG) console.log(`updating user dice ${aUser.name} ${$(aUserDiceID).data('updated')}:${aUser.updated}`);
      $(aUserDiceID).remove();
    }

    if (changed) {
      if (DEBUG) console.log(`update ${aUser.name}`);

      // Update user color
      usersColor[aUser.id] = aUser.color;

      const aDiceOut = createUserDice(aUser, data.time);
      const aDice = aDiceOut.html;

      if (aUser.id === user.id) {
        diceCountChanged = true;
        $('#dice').prepend(aDice);
        // Update die count
        for (let k = 0, len_k = aUser.dice.length; k < len_k; k++) {
          const die = aUser.dice[k];
          diceCount[die.type]++;
        }
      } else {
        if ($(`#${user.id}-dice`).length) {
          $(aDice).insertAfter(`#${user.id}-dice`);
        } else {
          $('#dice').prepend(aDice);
        }
      }

      diceAnimation(aDiceOut.animate, data.time);

      // Update status bar
      if (aUser.id === user.id) {
        let statusOut = '<div class="row">';
        statusOut += statusDice(aUser.dice, 'd4');
        statusOut += statusDice(aUser.dice, 'd6');
        statusOut += statusDice(aUser.dice, 'd8');
        statusOut += statusDice(aUser.dice, 'd10');
        statusOut += statusDice(aUser.dice, 'd12');
        statusOut += statusDice(aUser.dice, 'd20');
        statusOut += statusDice(aUser.dice, 'total', aUser.counter);
        statusOut += '</div>'

        if (aDiceOut.animate.length > 0) {
          // Delay status bar update
          setTimeout(() => {
            $(`#${aUser.id}-dice`).find('.user-dice-status').html(statusOut);
          }, dieAnimationTime.max);
        } else {
          $(`#${aUser.id}-dice`).find('.user-dice-status').html(statusOut);
        }
      }
    }
  }

  windowResize();

  if (diceCountChanged) {
    // Update dice count
    Object.keys(diceCount).forEach(diceType => {
      $(`#${diceType}-count`).html(diceCount[diceType]);
    });
  }

  // Remove existing users that are not in room-data
  existingUsers.forEach(e_id => {
    if (DEBUG) console.log(`removing user with id ${e_id}`);
    $(`#${e_id}-dice`).remove();
  });
}

function createUserDice(aUser, time) {
  const aColor = getUserColor(aUser);
  const animate = [];
  let aDice = `
<div id="${aUser.id}-dice" class="user-area col-12 mx-1 border border-dark rounded" data-user-id="${aUser.id}" data-updated="${aUser.updated}">
<div class="row user-status-bar bg-light">
  <div class="row user-name col-12 p-0 m-0 border border-success text-center">`;
  if (user.id === aUser.id) {
    aDice += `
    <div class="col-3 col-md-2 p-0 m-0 dice-buttons text-center row">
      <button class="btn btn-success col-4 p-0" type="button" onclick="counter(1)"><span>+</span></button>
      <span id="user-counter" class="col-4 p-0 text-center"><h5 class="m-0" value="${aUser.counter}">${aUser.counter}</h5></span>
      <button class="btn btn-danger col-4 p-0" type="button" onclick="counter(-1)"><span>-</span></button>
    </div>
    <div class="col-6 col-md-8"><h5 class="m-0">${aUser.name}</h5></div>
    <button class="btn btn-default col-3 col-md-2 p-0 m-0" onClick="removeUser('${aUser.name}')"><span>Exit</span></button>`;
  } else if (user.role === 'admin') {
    aDice += `
    <div class="col-3 col-md-2 p-0 m-0 dice-buttons text-center row">
      <button class="btn btn-success col-4 p-0" type="button" onclick="counter(1, '${aUser.name}')"><span>+</span></button>
      <span class="col-4 p-0 text-center"><h5 class="m-0">${aUser.counter}</h5></span>
      <button class="btn btn-danger col-4 p-0" type="button" onclick="counter(-1, '${aUser.name}')"><span>-</span></button>
    </div>
    <div class="col-6 col-md-8"><h5 class="m-0">${aUser.name}</h5></div>
    <button class="btn btn-default col-3 col-md-2 p-0 m-0" onClick="removeUser('${aUser.name}')"><span>Kick</span></button>`;
  } else {
    aDice += `
    <div class="col-3 col-md-2 p-0 m-0 dice-buttons text-center row">
      <span class="col-12 p-0 text-center"><h5 class="m-0">${aUser.counter}</h5></span>
    </div>
    <div class="col-6 col-md-8"><h5 class="m-0">${aUser.name}</h5></div>`;
  }

  aDice += `
  </div>
</div>`;

  const aUserColor = `rgba(${aColor[0]},${aColor[1]},${aColor[2]},0.8)`;
  if (aUser.share) {
    aDice += `
<div class="row user-dice" style="background-color: ${aUserColor};">`;
  } else {
    const aUserOpColor = `rgba(${255 - aColor[0]},${255 - aColor[1]},${255 - aColor[2]},0.8)`;

    aDice += `
<div class="row user-dice" style="background: repeating-linear-gradient(45deg, ${aUserColor}, ${aUserColor} 10px, ${aUserOpColor} 10px, ${aUserOpColor} 20px);">`;
  }

  if (aUser.dice.length > 0) {
    aUser.dice.forEach(die => {
      let dieValue = die.value;

      if (die.type === 'd10' && die.value === 10) dieValue = 0; // Display 10 on d10 as 0

      if ((time - die.time) < dieAnimationTime.get(die)) {
        animate.push(die);
      }

      let aDiceClick = '';
      let aDieID = '';
      if (user.id === aUser.id) {
        aDiceClick = 'dice-click';
        aDieID = `die-id="${die.id}"`;
      }

      aDice += `
  <div class="a-dice-container mx-auto">
    <div id="${die.id}-die" class="a-dice ${die.type} ${aDiceClick} text-center" ${aDieID}>
      <span class="die-number">${dieValue > -1 ? dieValue : '?'}</span>
    </div>
  </div>`;
    });
  } else {
    if (!aUser.share) {
      aDice += `
  <div class="dice-status col-12 text-center">Hidden</div>`;
    } else {
      aDice += `
  <div class="dice-status col-12 text-center">No Dice</div>`;
    }
  }
  aDice += `
</div>`;

  // Status bar
  if (aUser.id === user.id) {
    aDice += `
<div class="row user-status-bar bg-light">
  <div class="user-dice-status col-12 border border-success"></div>
</div>`;
  }

  aDice += `
</div>`;

  return { html: aDice, animate };
}

function roomLog(data) {
  if (DEBUG) console.log('adding log');
  let log = $('#log').html();
  const time = new Date(data.time);
  const timeStamp = `[${time.getHours()}:${time.getMinutes() < 10 ? '0' : ''}${time.getMinutes()}]`;

  if (data.share) {
    log = `<span class="row">${timeStamp}&nbsp;<b>${data.user}</b>&nbsp;${data.log}</span>${log}`;
  } else {
    log = `<span class="row">${timeStamp}&nbsp;<b>${data.user}</b>&nbsp;${data.log}&nbsp;<b>(H)</b></span>${log}`;
  }

  $('#log').html(log);
  // Scroll to bottom of log
  $('#log').scrollTop(0);
}

function windowResize() {

  // Resize map
  mapP5.resize();

  logResize(0);

  $('#dice').css('height', $('#map').outerHeight() - $('#log-container').outerHeight() - $('#log-resize').outerHeight());

  if ($(window).outerWidth() >= 768) {
    $('.toggle').hide();
    toggleDice(null);
  } else {
    $('.toggle').show();
    toggleDice(showDice);
  }
}

function logResize(data) {
  const logHeight = $('#log-container').outerHeight() + data * 50;
  const minHeight = 50;
  const maxHeight = $('#map').outerHeight() * 0.75;
  $('#log-container').css('height', Math.min(Math.max(logHeight, minHeight), maxHeight));

  if (data !== 0) windowResize();
}

$(document).ready(() => {
  // Load web socket
  socket = io();

  socket.on('connect', () => {
    if (DEBUG) console.log('connected to room');
    socket.emit('join', ROOM_ID); refreshSocket();
    socket.emit('enter-room', ROOM_ID); refreshSocket();
    // Get map data
    getMap();
  });
  socket.on('alert',         showAlert);
  socket.on('user-data',     userData);
  socket.on('room-data',     roomData);
  socket.on('map-data',      mapData);
  socket.on('map-data-type', receive);
  socket.on('room-log',      roomLog);
  socket.on('disconnect',    data => {
    if (DEBUG) console.log('disconnected');
  });

  // Events
  $(window).on('resize', windowResize);

  // Reset selected dice
  $(document).on('click', () => {
    selectedDice = null;
    $('.dice-click').removeClass('dice-selected');
    $('#dice-overlay').remove();
  });

  // Display dice specific options when own dice is clicked
  $(document).on('click', '.dice-click', function(event) {
    selectedDice = { anchor: this, id: $(this).attr('die-id')};

    $('.dice-click').removeClass('dice-selected');
    $('#dice-overlay').remove();
    $(diceOverlay).insertAfter(this);
    $(this).addClass('dice-selected');
    event.stopPropagation();
  });

  $(document).on('mouseenter', '#user-counter', function() {
    $(this).find('h5').html('0');
    if ($(this).find('h5').attr('value') == '0') {
      $(this).css('color', '#ffffff');
      $(this).css('background-color', '#007bff');
    } else {
      $(this).css('background-color', '#ffc107');
    }
  });

  $(document).on('mouseleave', '#user-counter', function() {
    $(this).find('h5').html($(this).find('h5').attr('value'));
    $(this).css('color', 'inherit');
    $(this).css('background-color', 'inherit');
  });

  $(document).on('click', '#user-counter', () => {
    counter(0, user.name); /* TODO: Allow admin to reset other user's counter */
  });

  // TODO: Make a reliable way to resize the log-container
  // $(document).on('mousedown', '#log-container', function(event) {
  //   if (event.originalEvent.offsetY < 4) { // Within :after height
  //     $(document).on('mousemove', function(event) {
  //       if (event.originalEvent.offsetY < 8) {
  //         var height = $('#log-container').height() - event.originalEvent.movementY;
  //         var stop = false;
  //         if (height > $('#dice').outerHeight() - 60) {
  //           height = $('#dice').outerHeight() - 60;
  //         } else if (height < 60) {
  //           height = 60;
  //         }
  //         $('#log-container').height(height);
  //         windowResize();
  //       }
  //     });
  //   }
  // });

  // $(document).on('mouseup', function(event) {
  //   $(document).off('mousemove');
  // });

  // $(document).on('wheel contextmenu', '#map canvas', event => {
  //   event.preventDefault();
  // });

  $(document).on('animationend', '.a-dice', event => {
    $(this).css('animation-name', '');
    $(this).css('animation-timing-function', '');
    $(this).css('animation-duration', '');
    $(this).css('animation-delay', '');
  });

  // Resize window on load
  windowResize();
});