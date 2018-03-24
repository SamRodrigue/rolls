// Elements
var socket;
var room_id = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
var user = { name: '', role: 'user'};
var dice_type = 'd4';
var selected_dice = null;
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

function show_alert(data) {
  alert(data + ', returning to index');
  //setTimeout(function() { Will be needed when alert moved to modal
    window.location.href = '/';
  //}, 2500);
}

function user_data(data) {
  user = data;
  socket.emit('get-room', { room_id: room_id }); socket.send('');
}

function remove_user(data) {
  if (user.role === 'admin' || user.name === data) {
    console.log('removing user ' + data);
    socket.emit('remove_user', { room_id: room_id, name: data }); socket.send('');
  }
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
      var out = '<div class="' + type + '-label col-6 col-md-4 col-lg-3 col-xl-2 text-center mx-auto"><span>Total: ' + total;
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

function counter(counter, name) {
  if (typeof name == 'undefined') {
    name = user.name;
  }
  socket.emit('counter', { room_id: room_id, counter: counter, name: name }); socket.send('');
}
  
$(document).ready(function() {
  // Load web socket
  socket = io();

  socket.on('connect', function() {
    console.log('connected to room');
    socket.emit('join', room_id); socket.send('');
    socket.emit('enter-room', room_id); socket.send('');
  });
  socket.on('alert',      function(text) { show_alert(text); });
  socket.on('user-data',  function(data) { user_data(data); });
  socket.on('room-data',  function(data) { room_data(data); });
  socket.on('room-log',   function(data) { room_log(data); });
  socket.on('disconnect', function(data) {
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
        <span class="col-4 p-0 text-center"><h5 class="m-0">` + a_user.counter + `</h5></span>
        <button class="btn btn-danger col-4 p-0" type="button" onclick="counter(-1)"><span>-</span></button>
      </div>
      <div class="col-6 col-md-8"><h5 class="m-0">` + a_user.name + `</h5></div>
      <button class="btn btn-default col-3 col-md-2 p-0 m-0" onClick="remove_user('` + a_user.name + `')"><span>Leave</span></button>`;
      } else if (user.role === 'admin') {
        a_dice += `
      <div class="col-3 col-md-2 p-0 m-0 dice-buttons text-center row">
        <button class="btn btn-success col-4 p-0" type="button" onclick="counter(1, ` + a_user.name + `)"><span>+</span></button>
        <span class="col-4 p-0 text-center"><h5 class="m-0">` + a_user.counter + `</h5></span>
        <button class="btn btn-danger col-4 p-0" type="button" onclick="counter(-1, ` + a_user.name + `)"><span>-</span></button>
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
      <div class="` + die.type + ((user.name === a_user.name) ? ` dice-click`: ``) + ` text-center mx-auto" style="height: 64px;" ` + ((user.name === a_user.name) ? `index="` + j + `"` : ``) + `>
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
    console.log(data.time);
    var time_stamp = '[' + time.getHours() + ':' + ((time.getMinutes() < 10) ? '0' : '') + time.getMinutes() + ']';
    log = '<span class="row">' + time_stamp + '&nbsp;<b>' + data.user + '</b>&nbsp;' + data.log + '</span>' + log;
    $('#log').html(log);
    // Scroll to bottom of log
    $('#log').scrollTop(0);
  }

  $(window).on('resize', function() {
    $('#log').css('height', 0);
    $('#log').css('height', $('#dice').outerHeight() - rem_px(1.0));
  });

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

  function rem_px(rem) {
    return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }
});