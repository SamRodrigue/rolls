// Elements
const MEDIA_MAPS = '/media/maps/';
var socket;
var room_id = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
var user = {
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
var users_color = {};
var log_container_height = 90;
var show_dice = true;
var share_dice = true;
var initialized = false;
var dice_type = 'd4';
var selected_dice = null;
var die_animation_time = { 
  min: 1000,
  max: 3000,
  get: function(id) {
    var i = parseInt(id, 36) % (this.max - this.min);
    return  i + this.min;
  }
};
var dice_overlay = `
<div class="row" id="dice-overlay">
<button class="btn btn-danger" id="dice-overlay-remove" type="button" onclick="remove_dice()">
  <span class="oi" data-glyph="x"></span>
</button>
<div id="dice-overlay-glow"></div>
<button class="btn btn-warning" id="dice-overlay-roll" type="button" onclick="roll_dice(true)">
  <span class="oi" data-glyph="random"></span>
</button>
</div>`;
var dice_color = {
  d4: '#3366FF', d6: '#FFFF00', d8: '#008000',
  d10: '#FF0000', d12: '#FF9900', d20: '#993366'
};

function show_alert(data) {
  var out = { kick: true, alert: '' };
  if (typeof data.kick != 'undefined') {
    out.kick = data.kick;
  }
  if (typeof data.alert == 'undefined') {
    out.alert = data;
  } else {
    out.alert = data.alert;
  }

  if (out.kick) {
    alert(out.alert + ', returning to index');
    //setTimeout(function() { Will be needed when alert moved to modal
      window.location.href = '/';
    //}, 2500);
  } else {
    alert(out.alert);
  }
}

// Needed to ensure that socket messages are sent
// TODO: Determine why additional .send is required after .emit
function refresh_socket() { socket.send(''); }

function user_data(data) { 
  user = data;

  if (!initialized) {
    var help_text = `
m: map mode</br>
g: move/grab mode</br>
d: draw mode</br>
x: erase mode</br>
o: toggle grid overlay</br>
+: zoom in</br>
-: zoom out</br>`;

    if (user.role === 'admin') {
      help_text += ` 
- Admin Only -</br>
w: wall mode</br>
e: entity mode</br>
a: asset mode</br>
b: brush texture mode</br>
f: fill texture mode</br>
0-9: select one of first 10 wall/entity/asset/texture depending on mode`;
      // Load textures
      $.getJSON(MEDIA_MAPS + 'textures/textures.json', function(data) {
        $.each(data, function(key, val) {
          $('#texture-containers').append(`
            <div class="texture-container col-3 text-center" onclick="myp5.setSpecificMode('texture', ` + val[0] + `); $('#tools-modal').modal('toggle');">
              <img class="row mx-auto" src="` + MEDIA_MAPS + `textures/` + val[2] + `" />
              <span class="mx-auto">` + val[1] + `</span>
            </div>`);
          $('#fill-containers').append(`
            <div class="fill-container col-3 text-center" onclick="myp5.setSpecificMode('fill', ` + val[0] + `); $('#tools-modal').modal('toggle');">
              <img class="row mx-auto" src="` + MEDIA_MAPS + `textures/` + val[2] + `" />
              <span class="mx-auto">` + val[1] + `</span>
            </div>`);
        });
      });

      $('#texture-containers').show();
      $('#fill-containers').show();

      // Load walls
      $.getJSON(MEDIA_MAPS + 'walls/walls.json', function(data) {
        $.each(data, function(key, val) {
          $('#wall-containers').append(`
    <div class="wall-container col-3 text-center" onclick="myp5.setSpecificMode('wall', ` + val[0] + `); $('#tools-modal').modal('toggle');">
      <img class="row mx-auto" src="` + MEDIA_MAPS + `walls/` + val[2] + `" />
      <span class="mx-auto">` + val[1] + `</span>
    </div>`);
        });
      });

      $('#wall-containers').show();

      // Load assets
      $.getJSON(MEDIA_MAPS + 'assets/assets.json', function(data) {
        $.each(data, function(key, val) {
          $('#asset-containers').append(`
    <div class="asset-container col-3 text-center" onclick="myp5.setSpecificMode('asset', ` + val[0] + `); $('#assets-modal').modal('toggle');">
      <img class="row mx-auto" src="` + MEDIA_MAPS + `assets/` + val[2] + `" />
      <span class="mx-auto">` + val[1] + `</span>
    </div>`);
        });
      });

      $('#update-button').show();
      $('#assets-button').show();
      $('#tools-modal-map').show();
    }

    // Set help text
    $('#help-container').append('<div class="mx-auto"><p>' + help_text + '</p></div>');

    // Load entities
    $.getJSON(MEDIA_MAPS + 'entities/entities.json', function(data) {
      $.each(data, function(key, val) {
        $('#entity-containers').append(`
  <div class="entity-container col-3 text-center" onclick="myp5.setSpecificMode('entity', ` + val[0] + `); $('#entities-modal').modal('toggle');">
    <img class="row mx-auto" src="` + MEDIA_MAPS + `entities/` + val[2] + `" />
    <span class="mx-auto">` + val[1] + `</span>
  </div>`);
      });
    });

    // Load common tools
    [['map', 'Map Mode'],
    ['move', 'Move Mode'],
    ['draw', 'Draw Mode'],
    ['erase', 'Erase Mode']
    ].forEach(function(data) {
      $('#tool-containers').append(`
  <div class="tool-container">
    <button onclick="myp5.setSpecificMode('` + data[0] + `'); $('#tools-modal').modal('toggle');">` + data[1] + `</button>
  </div>`);
    });

    // Set user color
    users_color[user.id] = user.color;

    // Update color wheel in tool menu
    var user_color = get_user_color(user);
    var color_value = (user_color[0] << 16) + (user_color[1] << 8) + user_color[2];
    var color_string = color_value.toString(16).padStart(6, '0');
    $('input#color-wheel').val('#' + color_string);

    socket.emit('get-room', { room_id: room_id }); refresh_socket();
    initialized = true;
  }

  // Load presets
  for (var i = 0; i < 2; ++i) {
    var preset = user.preset[i];
    if (preset.used) {
      var preset_content = '';

      if (preset.counter !== 0) {
        preset_content += `<h6 class="col-12"><span class="bg-`;
        preset_content += (preset.counter > 0) ? 'success' : 'danger';
        preset_content += `" style="border-radius: 5%;">Counter: ` + preset.counter + `</span></h6>`;
      }

      preset_content += `
<div class="preset-dice d-flex flex-wrap justify-content-center mx-auto">`;

      preset.dice.forEach((die) => {
        preset_content += `
<div class="` + die.type + ` small-die"></div>`;
      });

      preset_content += `</div>`;

      $('#preset' + (i + 1) + '-container').html(preset_content);
    }
  }
}

function get_map() {
  if (DEBUG) console.log('checking for map');
  // Check if map is fully loaded
  if (typeof myp5 !== 'undefined' &&
      myp5.isLoaded()) {
    if (DEBUG) console.log('updating map');
    socket.emit('get-map', { room_id: room_id }); refresh_socket();
    $('#map .loader').remove();
    $('#map canvas').show();
    window_resize();
  } else {
    // Wait a second to check if loaded
    setTimeout(get_map, 1000);
  }
}

function remove_user(data) {
  if (user.role === 'admin' || user.name === data) {
    if (DEBUG) console.log('removing user ' + data);
    socket.emit('remove-user', { room_id: room_id, name: data }); refresh_socket();
  }
}

// Map
function save_map() {
  var data = 'text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(myp5.save(true)));
  var a = document.createElement('a');
  a.href = 'data:' + data;
  a.download = 'mapData.json';
  a.download = 'mapData.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function load_map() {
  var input, file, fr;

  if (typeof window.FileReader !== 'function') {
    if (DEBUG) console.log("The file API is not supported on the browser");
    return;
  }

  input = document.getElementById('map-data-input');
  if (!input) {
    if (DEBUG) console.log("Culdn't find the map data element.");
  } else if (!input.files) {
    if (DEBUG) console.log("files property not supported");
  } else if (!input.files[0]) {
    show_alert({ kick: false, alert: "Please select a file before clicking 'Load'" });
  } else {
    file = input.files[0];
    fr = new FileReader();
    fr.onload = function(e) {
      var lines = e.target.result;
      var newMapData = JSON.parse(lines);
      newMapData.update = {
        walls: true,
        entities: true,
        assets: true,
        texture: true,
      };
      myp5.load(newMapData, false);
    };
    fr.readAsText(file);
  }
}

function send_map() {
  if (user.role !== 'admin') return;

  if (DEBUG) console.log('sending map');
  socket.emit('update-map', {
    room_id: room_id,
    map: myp5.save()
  }); refresh_socket();

  myp5.reset_update('all');
}

function map_data(data) {
  if (DEBUG) console.log('receiving map');
  myp5.load(data);
}

// Entities
function send_entities() {
  if (DEBUG) console.log('sending entities');
  socket.emit('update-entities-map', {
    room_id: room_id,
    entities: myp5.entities_save()
  }); refresh_socket();

  myp5.reset_update('entities');
}

function receive_entities(data) {
  if (DEBUG) console.log('receiving entities');
  myp5.entities_load(data);
}

// Lines
function send_lines() {
  if (DEBUG) console.log('sending lines');
  var out = myp5.lines_save();

  if (out.lines.length > 0) {
    socket.emit('update-lines-map', {
      room_id: room_id,
      id: out.id,
      lines: out.lines
    }); refresh_socket();
  }

  myp5.reset_update('lines');
}

function receive_lines(data) {
  myp5.lines_load(data);
}

// Dice
function toggle_dice(val) {
  var dice = $('#dice-content');
  var map = $('#map-content');

  if (val === null) {
    dice.show();
    map.show();
  } else {
    var toggle_status = $('#toggle-dice-status');
    show_dice = val;

    if (show_dice) {
      map.hide();
      dice.show();
      toggle_status.html('Map');
    } else {
      dice.hide();
      map.show();
      // Resize map
      myp5.resize();
      toggle_status.html('Dice');
    }
  }
}

function toggle_share_dice(val) {
  if (val !== null) {
    var share_status = $('#share-dice-status');
    var user_dice = $('#' + user.id + '-dice');
    share_dice = val;
    user.share = share_dice; // TODO: Directly modify user.share from val; remove share_dice

    if (share_dice) { // Shown
      share_status.attr('data-glyph', 'lock-unlocked');
    } else { // Hidden
      share_status.attr('data-glyph', 'lock-locked');
    }

    socket.emit('share-dice', { room_id: room_id, share: share_dice }); refresh_socket();
  }
}

function set_dice_type(type) {
  dice_type = type;
  $('#dice-type').text(type);
}

function add_dice(data) {
  if (DEBUG) console.log('adding ' + data);
  socket.emit('add-dice', { room_id: room_id, type: data }); refresh_socket();
}

function remove_dice(data) {
  var out;
  if (typeof data == 'undefined' && selected_dice !== null) {
    out = {
      room_id: room_id,
      index: selected_dice.index
    }
  } else {
    out = {
      room_id: room_id,
      type: data
    }
  }
  if (DEBUG) console.log('removing ' + data);
  socket.emit('remove-dice', out); refresh_socket();
}

function clear_dice() {
  if (DEBUG) console.log('clearing');
  socket.emit('clear-dice', { room_id: room_id }); refresh_socket();
}

function roll_dice(data) {
  var out = null;
  if (typeof data == 'undefined') {
    out = {
      room_id: room_id
    }
  } else if (selected_dice !== null) {
    out = {
      room_id: room_id,
      index: selected_dice.index
    }
  }

  if (out !== null) {
    if (DEBUG) console.log('rolling');
    socket.emit('roll-dice', out); refresh_socket();
  }
}

function status_dice(dice, type, counter) {
  var changed = false;
  if (type === 'total') {
    var total = 0;
    for (var i = 0, len = dice.length; i < len; i++) {
      var die = dice[i];
      changed = true;
      if (die.value > -1) {
        total += die.value;
      }
    }
    if (changed) {
      var out = '<div class="total-label text-center mx-auto p-0"><span class="mx-auto">Total: ' + total;
      if (counter !== 0) {
        out += ' (' + (total + counter) + ')';
      }
      return out + '</span></div>';
    }
  } else {
    var num = 0;
    var total = 0;
    for (var i = 0, len = dice.length; i < len; i++) {
      var die = dice[i];
      if (die.type === type) {
        changed = true;
        num++;
        if (die.value > -1) {
          total += die.value;
        }
      }
    }
    if (changed) {
      return '<div class="' + type + '-label col-6 col-md-4 col-lg-3 col-xl-2 text-center p-0"><span>' + num + type + ':' + total + '</span></div>';
    }
  }
  return '';
}

function dice_animation(animate, time) {
  animate.forEach(function(a_dice) {
    var a_dice_div = $('#' + a_dice.id + '-die');
    var delta = time - a_dice.time;
    var animation_time = die_animation_time.get(a_dice.id);

    // TODO: is this needed
    if (delta > animation_time) return;

    // CSS dice rolling animation
    a_dice_div.attr('style', die_animation(delta, animation_time, a_dice.value));

    if (a_dice.value === -1) return;

    var date = new Date();
    var start = date.getTime();

    var setint = setInterval(function () {
      var date = new Date();
      var prog = date.getTime() - start + delta;

      if (prog > animation_time) {
        var a_dice_value = a_dice.value;
        if (a_dice.type === 'd10' && a_dice_value === 10) a_dice_value = 0; // Display 10 on d10 as 0
        
        a_dice_div.find('span.die-number').text(a_dice_value);
        clearInterval(setint);
      } else {
        var i = Math.min(
          a_dice.anime.length,
          Math.floor(
            a_dice.anime.length * 
            Math.sqrt(prog / animation_time)
          )
        );

        var a_dice_value = a_dice.anime[i];
        if (a_dice.type === 'd10' && a_dice_value === 10) a_dice_value = 0; // Display 10 on d10 as 0

        a_dice_div.find('span.die-number').text(a_dice_value);
      }
    }, 10);
  });
}

function die_animation(delta, full, value) {
  if (delta > full) {
    return '';
  }
  var df = full/1000; // seconds
  var dd = delta/1000; // seconds

  var out;
  if (value === -1) {
    out = 'animation-name: glow; animation-timing-function: ease-out; animation-duration: ' + df + 's; animation-delay: -' + dd + 's;';
  } else {
    out = 'animation-name: shake, glow; animation-timing-function: cubic-bezier(0,1,0,1), ease-out; animation-duration: ' + df + 's, ' + df + 's; animation-delay: -' + dd + 's, -' + dd + 's;';
  }
  return out;
}

function counter(counter, name) {
  if (typeof name == 'undefined') {
    name = user.name;
  }
  socket.emit('counter', { room_id: room_id, counter: counter, name: name }); refresh_socket();
}

function preset(load, set) { // Save = 0, Load = 1
  if (load < 0 || load > 1) return;
  if (set < 0 || set > 1) return;

  socket.emit('preset', { room_id: room_id, type: load, preset: set }); refresh_socket();
}

function set_user_color(color_string) {
  // Confirm input is a color
  var s = new Option().style;
  s.color = color_string;
  if (s.color !== '') {
    users_color[user.id] = color_to_array(s.color);

    if (DEBUG) console.log('changing user color ' + users_color[user.id]);
    socket.emit('change-color', { room_id: room_id, color: users_color[user.id] }); refresh_socket();
  }

  // Update color wheel in tool menu
  var user_color = get_user_color(user);
  var color_value = (user_color[0] << 16) + (user_color[1] << 8) + user_color[2];
  var color_string = color_value.toString(16).padStart(6, '0');
  $('input#color-wheel').val('#' + color_string);
}

function get_user_color(a_user) {
  var a_user_id = 'nobody';

  if (typeof a_user === 'object') {
    a_user_id = a_user.id;
  } else if (typeof a_user === 'string') {
    a_user_id = a_user;
  }

  if (users_color.hasOwnProperty(a_user_id)) {
    if (typeof users_color[a_user_id] !== 'undefined') {
      return users_color[a_user_id];
    }

    // Delete undefined color
    delete users_color[a_user.id];
  }

  // Colors should be provided by the server
  return color_from_string(a_user_id);
}

function color_from_string(str) {
  var hash = 5381;
  var i = str.length;

  while(i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }
  hash = hash >>> 0;

  var out = [
    (((hash & 0xFF000000) >> 24) % 8) * 32,
    (((hash & 0x00FF0000) >> 16) % 8) * 32,
    (((hash & 0x0000FF00) >> 8) % 8) * 32
  ];

  return out;
}

function color_to_array(color_string) {
  if (!color_string) {
    return;
  }

  var out = [0, 0, 0];

  var regex = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/;
  if (regex.test(color_string)) {
    var out_string = color_string.match(regex);
    out = [
      parseInt(out_string[1]),
      parseInt(out_string[2]),
      parseInt(out_string[3])
    ];
  }

  return out;
}

// Window dependant
function room_data(data) {
  if (DEBUG) console.log('updating room');
  $('#dice .loader').remove();

  var dice = '';
  var user_dice = '';
  var dice_count = { d4: 0, d6: 0, d8: 0, d10: 0, d12:0, d20:0 };
  var dice_count_changed = false;

  // Get list of existing user areas
  var existing_users = [];
  $('#dice > .user-area').each(function() {
    existing_users.push($(this).data('user-id'));
  });
  for (var i = 0, len = data.users.length; i < len; i++) {
    var a_user = data.users[i];
    var changed = false;

    // Remove from existing users list; user still exists
    existing_users = existing_users.filter(function(e_id) {
      return e_id !== a_user.id;
    });

    // Get user dice area
    var a_user_dice_id = '#' + a_user.id + '-dice';
    if ($(a_user_dice_id).length === 0) { // New user or user dice div is missing
      changed = true;
      if (DEBUG) console.log('adding missing user dice ' + a_user.name);
    } else if ($(a_user_dice_id).data('updated') !== a_user.updated) { // Existing user dice needs to be updated
      changed = true;
      if (DEBUG) console.log('updating user dice ' + a_user.name + ' ' + $(a_user_dice_id).data('updated') + ':' + a_user.updated);
      $(a_user_dice_id).remove();
    }

    if (changed) {
      if (DEBUG) console.log('update ' + a_user.name);

      // Update user color
      users_color[a_user.id] = a_user.color;

      var a_dice_out = create_user_dice(a_user, data.time);
      var a_dice = a_dice_out.html;

      if (a_user.id === user.id) {
        dice_count_changed = true;
        $('#dice').prepend(a_dice);
        // Update die count
        for (var k = 0, len_k = a_user.dice.length; k < len_k; k++) {
          var die = a_user.dice[k];
          dice_count[die.type]++;
        }
      } else {
        if ($('#' + user.id + '-dice').length) {
          $(a_dice).insertAfter('#' + user.id + '-dice');
        } else {
          $('#dice').prepend(a_dice);
        }
      }

      dice_animation(a_dice_out.animate, data.time);

      // Update status bar
      if (a_user.id === user.id) {
        var status_out = '<div class="row">';
        status_out += status_dice(a_user.dice, 'd4');
        status_out += status_dice(a_user.dice, 'd6');
        status_out += status_dice(a_user.dice, 'd8');
        status_out += status_dice(a_user.dice, 'd10');
        status_out += status_dice(a_user.dice, 'd12');
        status_out += status_dice(a_user.dice, 'd20');
        status_out += status_dice(a_user.dice, 'total', a_user.counter);
        status_out += '</div>'
    
        if (a_dice_out.animate.length > 0) {
          // Delay status bar update
          setTimeout(function() {
            $('#' + a_user.id + '-dice').find('.user-dice-status').html(status_out);
          }, die_animation_time.max);
        } else {
          $('#' + a_user.id + '-dice').find('.user-dice-status').html(status_out);
        }
      }
    }
  }

  window_resize();

  if (dice_count_changed) {
    // Update dice count
    Object.keys(dice_count).forEach(function(dice_type) {
      $('#' + dice_type + '-count').html(dice_count[dice_type]);
    });
  }

  // Remove existing users that are not in room-data
  existing_users.forEach(function(e_id) {
    if (DEBUG) console.log('removing user with id ' + e_id);
    $('#' + e_id + '-dice').remove();
  });
}

function create_user_dice(a_user, time) {
  var a_color = get_user_color(a_user);
  var animate = [];
  var a_dice = `
<div id="` + a_user.id + `-dice" class="user-area col-12 mx-1 border border-dark rounded" data-user-id="` + a_user.id + `" data-updated="` + a_user.updated + `">
<div class="row user-status-bar bg-light">
  <div class="row user-name col-12 p-0 m-0 border border-success text-center">`;
  if (user.id === a_user.id) {
    a_dice += `
    <div class="col-3 col-md-2 p-0 m-0 dice-buttons text-center row">
      <button class="btn btn-success col-4 p-0" type="button" onclick="counter(1)"><span>+</span></button>
      <span id="user-counter" class="col-4 p-0 text-center"><h5 class="m-0" value="` + a_user.counter + `">` + a_user.counter + `</h5></span>
      <button class="btn btn-danger col-4 p-0" type="button" onclick="counter(-1)"><span>-</span></button>
    </div>
    <div class="col-6 col-md-8"><h5 class="m-0">` + a_user.name + `</h5></div>
    <button class="btn btn-default col-3 col-md-2 p-0 m-0" onClick="remove_user('` + a_user.name + `')"><span>Exit</span></button>`;
  } else if (user.role === 'admin') {
    a_dice += `
    <div class="col-3 col-md-2 p-0 m-0 dice-buttons text-center row">
      <button class="btn btn-success col-4 p-0" type="button" onclick="counter(1, '` + a_user.name + `')"><span>+</span></button>
      <span class="col-4 p-0 text-center"><h5 class="m-0">` + a_user.counter + `</h5></span>
      <button class="btn btn-danger col-4 p-0" type="button" onclick="counter(-1, '` + a_user.name + `')"><span>-</span></button>
    </div>
    <div class="col-6 col-md-8"><h5 class="m-0">` + a_user.name + `</h5></div>
    <button class="btn btn-default col-3 col-md-2 p-0 m-0" onClick="remove_user('` + a_user.name + `')"><span>Kick</span></button>`;
  } else {
    a_dice += `
    <div class="col-3 col-md-2 p-0 m-0 dice-buttons text-center row">
      <span class="col-12 p-0 text-center"><h5 class="m-0">` + a_user.counter + `</h5></span>
    </div>
    <div class="col-6 col-md-8"><h5 class="m-0">` + a_user.name + `</h5></div>`;
  }

  a_dice += `
  </div>`;

  // Status bar
  if (a_user.id === user.id) {
    a_dice += `
  <div class="user-dice-status col-12 border border-success"></div>`;
  }

  a_dice += `
</div>`;

  var a_user_color = 'rgba(' + a_color[0] + ',' + a_color[1] + ',' + a_color[2] + ',0.8)';
  if (a_user.share) {
    a_dice += `
<div class="row user-dice" style="background-color: ` + a_user_color + `;">`;
  } else {
    var a_user_op_color = 'rgba(' + (255 - a_color[0]) + ',' + (255 - a_color[1]) + ',' + (255 - a_color[2]) + ',0.8)';

    a_dice += `
<div class="row user-dice" style="background: repeating-linear-gradient(45deg, ` + a_user_color + `, ` + a_user_color + ` 10px, ` + a_user_op_color + ` 10px, ` + a_user_op_color + ` 20px);">`;
  }

  if (a_user.dice.length > 0) {
    for (var j = 0, len_j = a_user.dice.length; j < len_j; j++) {
      var die = a_user.dice[j];
      var die_value = die.value;

      if (die.type === 'd10' && die.value === 10) die_value = 0; // Display 10 on d10 as 0

      if ((time - die.time) < die_animation_time.get(die.id)) {
        animate.push(die);
      }

      // TODO: remove die index and start using die id
      a_dice += `
  <div class="a-dice-container mx-auto">
    <div id="` + die.id + `-die" class="a-dice ` + die.type + ((user.name === a_user.name) ? ` dice-click`: ``) + ` text-center" ` + ((user.name === a_user.name) ? `index="` + j + `"` : ``) + `">
      <span class="die-number">` + ((die_value > -1) ? die_value : '?') + `</span>
    </div>
  </div>`;
    }
  } else {
    if (!a_user.share) {
      a_dice += `
  <div class="dice-status col-12 text-center">Hidden</div>`;
    } else {
      a_dice += `
  <div class="dice-status col-12 text-center">No Dice</div>`;
    }
  }
  a_dice += `
</div>
</div>`;

  return { html: a_dice, animate: animate };
}

function room_log(data) {
  if (DEBUG) console.log('adding log');
  var log = $('#log').html();
  var time = new Date(data.time);
  var time_stamp = '[' + time.getHours() + ':' + ((time.getMinutes() < 10) ? '0' : '') + time.getMinutes() + ']';

  if (data.share) {
    log = '<span class="row">' + time_stamp + '&nbsp;<b>' + data.user + '</b>&nbsp;' + data.log + '</span>' + log;
  } else {
    log = '<span class="row">' + time_stamp + '&nbsp;<b>' + data.user + '</b>&nbsp;' + data.log + '&nbsp;<b>(H)</b></span>' + log; 
  }

  $('#log').html(log);
  // Scroll to bottom of log
  $('#log').scrollTop(0);
}

function window_resize() {

  // Resize map
  myp5.resize();

  log_resize(0);

  $('#dice').css('height', $('#map').outerHeight() - $('#log-container').outerHeight() - $('#log-resize').outerHeight());

  if ($(window).outerWidth() >= 768) {
    $('.toggle').hide();
    toggle_dice(null);
  } else {
    $('.toggle').show();
    toggle_dice(show_dice);
  }
}

function log_resize(data) {
  var log_height = $('#log-container').outerHeight() + data * 50;
  var min_height = 50;
  var max_height = $('#map').outerHeight() * 0.75;
  $('#log-container').css('height', Math.min(Math.max(log_height, min_height), max_height));

  if (data !== 0) window_resize();
}

// Currently not used
// function rem_px(rem) {
//   return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
// }

$(document).ready(function() {
  // Load web socket
  socket = io();

  socket.on('connect', function() {
    if (DEBUG) console.log('connected to room');
    socket.emit('join', room_id); refresh_socket();
    socket.emit('enter-room', room_id); refresh_socket();
    // Get map data
    get_map();
  });
  socket.on('alert',             show_alert);
  socket.on('user-data',         user_data);
  socket.on('room-data',         room_data);
  socket.on('map-data',          map_data);
  socket.on('entities-map-data', receive_entities);
  socket.on('lines-map-data',    receive_lines);
  socket.on('room-log',          room_log);
  socket.on('disconnect',        function(data) {
    if (DEBUG) console.log('disconnected');
  });

  // Events
  $(window).on('resize', window_resize);

  // Reset selected dice
  $(document).on('click', function() {
    selected_dice = null;
    $('.dice-click').removeClass('dice-selected');
    $('#dice-overlay').remove();
  });

  // Display dice specific options when own dice is clicked
  $(document).on('click', '.dice-click', function(event) {
    selected_dice = { anchor: this, index: $(this).attr('index')};

    //var pos = $(this).position();
    $('.dice-click').removeClass('dice-selected');
    $('#dice-overlay').remove();
    $(dice_overlay).insertAfter(this);
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

  $(document).on('click', '#user-counter', function() {
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
  //         window_resize();
  //       }
  //     });
  //   }
  // });

  // $(document).on('mouseup', function(event) {
  //   $(document).off('mousemove');
  // });

  $(document).on('wheel', '#map canvas', function(event) {
    event.preventDefault();
  });

  $(document).on('contextmenu', '#map canvas', function(event) {
    event.preventDefault();
  });

  $(document).on('change', 'input#color-wheel', function(event) {
    set_user_color(this.value);
  });

  $(document).on('animationend', '.a-dice', function(event) {
    $(this).css('animation-name', '');
    $(this).css('animation-timing-function', '');
    $(this).css('animation-duration', '');
    $(this).css('animation-delay', '');
  });

  // Resize window on load
  window_resize();
  // function resize_on_load() {
  //   // Check if map is fully loaded
  //   console.log('checking');
  //   if (typeof myp5 !== 'undefined' &&
  //       myp5.isLoaded()) {
  //     console.log('update');
  //     window_resize();
  //   } else {
  //     setTimeout(resize_on_load, 100);
  //   }
  // }; resize_on_load();
});