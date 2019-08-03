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
var log_container_height = 90;
var show_dice = true;
var dice_type = 'd4';
var selected_dice = null;
var die_glow_time = 1000;
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
  d4: '#3366ff', d6: '#ffff00', d8: '#008000',
  d10: '#ff0000', d12: '#ff9900', d20: '#993366'
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

function user_data(data) {
  user = data;

  if (user.role === 'admin') {
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
  [['map', 'Map Mode'], ['move', 'Move Mode'], ['erase', 'Erase Mode']].forEach(function(data) {
    $('#tool-containers').append(`
<div class="tool-container">
  <button onclick="myp5.setSpecificMode('` + data[0] + `'); $('#tools-modal').modal('toggle');">` + data[1] + `</button>
</div>`);
  });

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

      user.preset[i].dice.forEach((die) => {
        preset_content += `
<div class="` + die.type + ` small-die"></div>`;
      });

      preset_content += `</div>`;

      $('#preset' + (i + 1) + '-container').html(preset_content);
    }
  }

  socket.emit('get-room', { room_id: room_id }); refresh_socket();
}

function get_map() {
  console.log('checking for map');
  // Check if map is fully loaded
  if (typeof myp5 !== 'undefined' &&
      myp5.isLoaded()) {
    console.log('updating map');
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
    console.log('removing user ' + data);
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
    alert("The file API isn't supported on this browser yet.");
    return;
  }

  input = document.getElementById('map-data-input');
  if (!input) {
    alert("Um, couldn't find the map data element.");
  }
  else if (!input.files) {
    alert("This browser doesn't seem to support the `files` property of file inputs.");
  }
  else if (!input.files[0]) {
    alert("Please select a file before clicking 'Load'");
  }
  else {
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

  console.log('sending map');
  socket.emit('update-map', {
    room_id: room_id,
    map: myp5.save()
  }); refresh_socket();

  myp5.reset_update('all');
}

function map_data(data) {
  console.log('receiving map');
  myp5.load(data);
}

function send_entities() {
  console.log('sending entities');
  socket.emit('update-entities-map', {
    room_id: room_id,
    entities: myp5.entities_save()
  }); refresh_socket();

  myp5.reset_update('entities');
}

function entities_map_data(data) {
  console.log('receiving entities');
  myp5.entities_load(data);
}

// Dice
function set_dice_type(type) {
  dice_type = type;
  $('#dice-type').text(type);
}

function add_dice(data) {
  console.log('adding ' + data);
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
  console.log('removing ' + data);
  socket.emit('remove-dice', out); refresh_socket();
}

function clear_dice() {
  console.log('clearing');
  socket.emit('clear-dice', { room_id: room_id }); refresh_socket();
}

function roll_dice(data) {
  var out;
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
  console.log('rolling');
  socket.emit('roll-dice', out); refresh_socket();
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

function die_animation(type, delta, full) {
  if (delta > full) {
    return '';
  }
  var out = 'animation-name: ' + type + '-glow; animation-timing-function: linear; animation-duration: ' + full/1000 + 's; animation-delay: -' + delta/1000 + 's;';
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

function hashString(str) {
  var hash = 5381,
      i    = str.length;
  while(i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  return hash >>> 0;
}

function colorString(str) {
  var hash = hashString(str);

  var out = [
    (((hash & 0xFF000000) >> 24) % 8) * 32,
    (((hash & 0x00FF0000) >> 16) % 8) * 32,
    (((hash & 0x0000FF00) >> 8) % 8) * 32
  ];

  return out;
}

/* function colorStringHex(str) {
  var rgb = colorString(str);
  var hex = rgb[0] << 16
          | rgb[1] << 8
          | rgb[2];
  var out = '#' + hex.toString(16).padStart(6, '0');
  console.log(out);

  return out;
} */

// Window dependant
function room_data(data) {
  console.log('updating room');
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
      console.log('adding missing user dice ' + a_user.name);
    } else if ($(a_user_dice_id).data('updated') !== a_user.updated) { // Existing user dice needs to be updated
      changed = true;
      console.log('updating user dice ' + a_user.name + ' ' + $(a_user_dice_id).data('updated') + ':' + a_user.updated);
      $(a_user_dice_id).remove();
    }

    if (changed) {
      console.log('update ' + a_user.name);
      var a_dice = create_user_dice(a_user, data.time);

      if (user.name === a_user.name) {
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
    console.log('removing user with id ' + e_id);
    $('#' + e_id + '-dice').remove();
  });
}

function create_user_dice(a_user, time) {
  var a_color = colorString(a_user.name);
  var a_dice = `
<div id="` + a_user.id + `-dice" class="user-area col-12 mx-1 border border-dark rounded" data-user-id="` + a_user.id + `" data-updated="` + a_user.updated + `">
<div class="row user-status-bar bg-light">
  <div class="row user-name col-12 p-0 m-0 border border-success text-center">`;
    if (user.name === a_user.name) {
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
  </div>
  <div class="user-dice-status col-12 border border-success">
    <div class="row">`;
    a_dice += status_dice(a_user.dice, 'd4');
    a_dice += status_dice(a_user.dice, 'd6');
    a_dice += status_dice(a_user.dice, 'd8');
    a_dice += status_dice(a_user.dice, 'd10');
    a_dice += status_dice(a_user.dice, 'd12');
    a_dice += status_dice(a_user.dice, 'd20');
    a_dice += status_dice(a_user.dice, 'total', a_user.counter);
    a_dice += `
    </div>
  </div>
</div>
<div class="row user-dice" style="background-color: rgba(` + a_color[0] + `,` + a_color[1] + `,` + a_color[2] + `,0.8);">`;
    if (a_user.dice.length > 0) {
      for (var j = 0, len_j = a_user.dice.length; j < len_j; j++) {
        var die = a_user.dice[j];
        var die_value = die.value;
        if (die.type === 'd10' && die.value === 10) die_value = 0;
        a_dice += `
    <div class="` + die.type + ((user.name === a_user.name) ? ` dice-click`: ``) + ` text-center mx-auto" style="height: 64px; ` + die_animation(die.type, (time - die.time), die_glow_time) + `" ` + ((user.name === a_user.name) ? `index="` + j + `"` : ``) + `">
      <span class="die-number">` + ((die_value > -1) ? die_value : '?') + `</span>
    </div>`;
      }
    } else {
      a_dice += `
    <div class="col-12 text-center">No Dice</div>`;
    }
    a_dice += `
</div>
</div>`;

  return a_dice;
}

function room_log(data) {
  console.log('adding log');
  var log = $('#log').html();
  var time = new Date(data.time);
  //console.log(data.time);
  var time_stamp = '[' + time.getHours() + ':' + ((time.getMinutes() < 10) ? '0' : '') + time.getMinutes() + ']';
  log = '<span class="row">' + time_stamp + '&nbsp;<b>' + data.user + '</b>&nbsp;' + data.log + '</span>' + log;
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
    console.log('connected to room');
    socket.emit('join', room_id); refresh_socket();
    socket.emit('enter-room', room_id); refresh_socket();
    // Get map data
    get_map();
  });
  socket.on('alert',             show_alert);
  socket.on('user-data',         user_data);
  socket.on('room-data',         room_data);
  socket.on('map-data',          map_data);
  socket.on('entities-map-data', entities_map_data);
  socket.on('room-log',          room_log);
  socket.on('disconnect',        function(data) {
      console.log('disconnected');
  });

  // Events
  $(window).on('resize', window_resize);

  // Reset selected dice
  $(document).on('click', function() {
    selected_dice = null;
    $('#dice-overlay').remove();
  });

  // Display dice specific options when own dice is clicked
  $(document).on('click', '.dice-click', function(event) {
    selected_dice = { anchor: this, index: $(this).attr('index')};

    //var pos = $(this).position();
    $('#dice-overlay').remove();
    $(this).append(dice_overlay);
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