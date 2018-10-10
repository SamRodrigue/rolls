// Elements
var socket;
var room_id = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
var user = { name: '', role: 'user'};
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
  d10: '#ff0000', d12: '#ff9900', d20: '#993366' };

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
  socket.emit('get-room', { room_id: room_id }); socket.send('');
}

function get_map() {
  console.log('checking for map');
  // Check if map is fully loaded
  if (typeof myp5 !== 'undefined' &&
      myp5.isLoaded()) {
    console.log('updating map');
    socket.emit('get-map', { room_id: room_id }); socket.send('');
  } else {
    // Wait a second to check if loaded
    setTimeout(get_map, 1000);
  }
}

function remove_user(data) {
  if (user.role === 'admin' || user.name === data) {
    console.log('removing user ' + data);
    socket.emit('remove-user', { room_id: room_id, name: data }); socket.send('');
  }
}

// Map
function save_map() {
  var data = 'text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(myp5.save()));
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
      myp5.load(newMapData);
    };
    fr.readAsText(file);
  }
}

function send_map() {
  if (user.role !== 'admin') {
    send_client_map();
    return;
  }
  console.log('sending map');
  socket.emit('update-map', { 
    room_id: room_id,
    map: myp5.save() 
  }); socket.send('');
}

function map_data(data) {
  console.log('receiving map');
  myp5.load(data);
}

function send_client_map() {
  console.log('sending client entities');
  socket.emit('update-client-map', {
    room_id: room_id,
    entities: myp5.client_save()
  }); socket.send('');
}

function client_map_data(data) {
  console.log('receiving client entities');
  myp5.client_load(data);
}

// Dice
function set_dice_type(type) {
  dice_type = type;
  $('#dice-type').text(type);
}

function add_dice(data) {
  console.log('adding ' + data);
  socket.emit('add-dice', { room_id: room_id, type: data }); socket.send('');
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
  socket.emit('remove-dice', out); socket.send('');
}

function clear_dice() {
  console.log('clearing');
  socket.emit('clear-dice', { room_id: room_id }); socket.send('');
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
  socket.emit('roll-dice', out); socket.send('');
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
      var out = '<div class="total-label text-center mx-auto"><span class="mx-auto">Total: ' + total;
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
      return '<div class="' + type + '-label col-6 col-md-4 col-lg-3 col-xl-2 text-center"><span>' + num + type + ':' + total + '</span></div>';
    }
  }
  return '';
}

function die_animation(type, delta, full) {
  if (delta > full) {
    return;
  }
  var out = 'animation-name: ' + type + '-glow; animation-timing-function: linear; animation-duration: ' + full/1000 + 's; animation-delay: -' + delta/1000 + 's;';
  return out;
}

function counter(counter, name) {
  if (typeof name == 'undefined') {
    name = user.name;
  }
  socket.emit('counter', { room_id: room_id, counter: counter, name: name }); socket.send('');
}

function preset(load, set) { // Save = 0, Load = 1
  if (load < 0 || load > 1) return;
  if (set < 0 || set > 1) return;
  
  socket.emit('preset', { room_id: room_id, type: load, preset: set }); socket.send('');
}
  
$(document).ready(function() {
  // Load web socket
  socket = io();

  socket.on('connect', function() {
    console.log('connected to room');
    socket.emit('join', room_id); socket.send('');
    socket.emit('enter-room', room_id); socket.send('');
    // Get map data
    get_map();
  });
  socket.on('alert',           function(data) { show_alert(data); });
  socket.on('user-data',       function(data) { user_data(data);  });
  socket.on('room-data',       function(data) { room_data(data);  });
  socket.on('map-data',        function(data) { map_data(data);   });
  socket.on('client-map-data', function(data) { client_map_data(data); });
  socket.on('room-log',        function(data) { room_log(data);   });
  socket.on('disconnect',      function(data) {
      console.log('disconnected');
  });

  function room_data(data) {
    console.log('updating room');
    var dice = '';
    var user_dice = '';
    var dice_count = { d4: 0, d6: 0, d8: 0, d10: 0, d12:0, d20:0 };
    for (var i = 0, len = data.users.length; i < len; i++) {
      var a_user = data.users[i];
      var a_dice = `
<div class="user-area col-12 m-1 border border-dark rounded mx-auto">
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
      <button class="btn btn-default col-3 col-md-2 p-0 m-0" onClick="remove_user('` + a_user.name + `')"><span>Leave</span></button>`;
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
  <div class="row user-dice">`;
      if (a_user.dice.length > 0) {
        for (var j = 0, len_j = a_user.dice.length; j < len_j; j++) {
          var die = a_user.dice[j];
          a_dice += `
      <div class="` + die.type + ((user.name === a_user.name) ? ` dice-click`: ``) + ` text-center mx-auto" style="height: 64px; ` + die_animation(die.type, (data.time - die.time), die_glow_time) + `" ` + ((user.name === a_user.name) ? `index="` + j + `"` : ``) + `">
        <span class="die-number">` + ((die.value > -1) ? die.value : '?') + `</span>
      </div>`;
        }
      } else {
        a_dice += `
      <div class="col-12 text-center">No Dice</div>`;
      }
      a_dice += `
  </div>
</div>`;
      if (user.name === a_user.name) {
        user_dice = a_dice;
        // Update die count
        for (var k = 0, len_k = a_user.dice.length; k < len_k; k++) {
          var die = a_user.dice[k];
          dice_count[die.type]++;
        }
      }
      else dice += a_dice;
    }
    // Add user to top of list
    dice = user_dice + dice;
    $('#dice').html(dice);
    $('#log').css('height', 0);
    $('#log').css('height', $('#dice').outerHeight() - rem_px(1.0));
    $('#log').scrollTop(0);

    Object.keys(dice_count).forEach(function(dice_type) {
      $('#' + dice_type + '-count').html(dice_count[dice_type]);
    });
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
    $('#log').css('height', 0);
    $('#log').css('height', $('#dice').outerHeight() - rem_px(1.0));
    var ww = $(window).outerWidth();

    if (ww >= 992) {
      $('.toggle').hide();
      toggle_dice(null);
    } else {
      $('.toggle').show();
      toggle_dice(show_dice);
    }
    // Resize map
    myp5.resize();
  }

  $(window).on('resize', window_resize);

  // Reset selected dice
  $(document).on('click', function() {
    selected_dice = null;
    $('#dice-overlay').remove();
  });

  // Display dice specific options when own dice is clicked
  $(document).on('click', '.dice-click', function(event) {
    selected_dice = { anchor: this, index: $(this).attr('index')};

    var pos = $(this).position();
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
    counter(0, user.name); /* ToDo: Allow admin to reset other user's counter */
  });

  $(document).on('wheel', '#map canvas', function(event) {
    event.preventDefault();
  });

  function rem_px(rem) {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  // Call functions on load
  window_resize();
});