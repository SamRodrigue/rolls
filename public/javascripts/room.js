// Elements
var socket;
var room_id = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
var user = { name: '', role: 'user'};
var dice_type = 'd4';
var selected_dice = null;

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
  if (typeof data == 'undefined') {
    out = {
      room_id: room_id,
      index: selected_dice
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
  } else {
    out = {
      room_id: room_id,
      index: selected_dice
    }
  }
  console.log('rolling');
  socket.emit('roll-dice', out); socket.send('');
}

function status_dice(dice, type) {
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
      return '<div class="' + type + '-label col-6 col-md-4 col-lg-3 col-xl-2 text-center mx-auto"><span>Total: ' + total + '</span></div>';
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

  function room_data(data) {
    console.log('updating room');
    var dice = '';
    var user_dice = '';
    var dice_count = { d4: 0, d6: 0, d8: 0, d10: 0, d12:0, d20:0 };
    for (var i = 0, len = data.users.length; i < len; i++) {
      var a_user = data.users[i];
      var a_dice = `
<div class="user-area col-12 m-1 border border-dark rounded">
  <div class="row user-status-bar">
    <div class="row user-name col-12 p-0 m-0 border border-success text-center">
      <div class="col-11">
        <h5>` + a_user.name + `</h5>
      </div>`;
      if (user.role === 'admin' || user.name === a_user.name) {
        a_dice += `
      <button class="btn btn-default col-1 p-0 m-0" onClick="remove_user('` + a_user.name + `')">
        <span>&times</span>
      </button>`;
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
      a_dice += status_dice(a_user.dice, 'total');
      a_dice += `
      </div>
    </div>
  </div>
  <div class="row user-dice">`;
      if (a_user.dice.length > 0) {
        for (var j = 0, len_j = a_user.dice.length; j < len_j; j++) {
          var die = a_user.dice[j];
          a_dice += `
      <div class="` + die.type + ((user.name === a_user.name) ? ` dice-click`: ``) + ` p-2 col-4 col-sm-4 col-md-2 col-lg-1 mx-auto" style="height: 64px;" ` + ((user.name === a_user.name) ? `index="` + j + `"` : ``) + `>
        <span class="center die-number">` + ((die.value > -1) ? die.value : '?') + `</span>
      </div>`;
        }
      } else {
        a_dice += `
      <span>No Dice</span>`;
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
    $('#log').css('height', $('#dice').outerHeight());
    $('#log').scrollTop($('#log')[0].scrollHeight - $('#log').height());

    Object.keys(dice_count).forEach(function(dice_type) {
      $('#' + dice_type + '-count').html(dice_count[dice_type]);
    });
  }

  function room_log(data) {
    console.log('adding log');
    var log = $('#log').html();
    var time = new Date(data.time);
    console.log(data.time);
    var time_stamp = '[' + time.getHours() + ':' + time.getMinutes() + ']';
    log = '<span class="row">' + time_stamp + ' ' + data.user + ' ' + data.log + '</span>' + log;
    $('#log').html(log);
    // Scroll to bottom of log
    $('#log').scrollTop(0); //$('#log')[0].scrollHeight - $('#log').height());
  }

  // Reset selected dice
  $(document).on('click', function() {
    selected_dice = null;
    $('#dice-overlay').css('top', '-100px');
  });

  // Display dice specific options when own dice is clicked
  $(document).on('click', '.dice-click', function(event) {
    selected_dice = $(this).attr('index');
    var pos = $(this).offset();
    $('#dice-overlay').css('left', (pos.left - 18) + 'px');
    $('#dice-overlay').css('top', pos.top + 'px');
    event.stopPropagation();
  });
});