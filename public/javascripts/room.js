// Elements
var socket;
var room_id = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
var user = { name: '' };
var dice_type = 'd4';
var colors = {
  d4: 'primary',
  d6: 'secondary',
  d8: 'success',
  d10: 'danger',
  d12: 'warning',
  d20: 'info'
}

// Dice
function set_dice_type(type) {
  dice_type = type;
  $('#dice-type').text(type);
  $('#dice-type').val(type);
}

function add_dice() {
  console.log('adding ' + dice_type);
  socket.emit('add-dice', { room_id: room_id, type: dice_type }); socket.send('');
}

function remove_dice() {
  console.log('removing ' + dice_type);
}

function roll_dice() {
  console.log('rolling');
  socket.emit('roll-dice', { room_id: room_id }); socket.send('');
}

function status_dice(dice, type) {
  if (type === 'total') {
    var total = 0;
    for (var die of dice) {
      if (die.value > -1) {
        total += die.value;
      }
    }
    return 'Total: ' + total;
  } else {
    var num = 0;
    var total = 0;
    for (var die of dice) {
      if (die.type === type) {
        num++;
        if (die.value > -1) {
          total += die.value;
        }
      }
    }
    return '' + num + type + ':' + total;
  }
}
  
$(document).ready(function() {
  // Load web socket
  socket = io();

  socket.on('connect', function() {
    console.log('connected to room');
    socket.emit('join', room_id); socket.send('');
    socket.emit('enter-room', room_id); socket.send('');
  });
  socket.on('alert',      function(text) { alert(text) });
  socket.on('user-data',  function(data) { user = data; });
  socket.on('room-data',  function(data) { room_data(data); });
  socket.on('disconnect', function(data) {
      console.log('disconnected');
  });

  function room_data(data) {
    //alert(JSON.stringify(data));
    // Add users
    console.log('updating room');
    var dice = '';
    for (var a_user of data.users) {
      dice += `
<div class="user-area col-12 m-1 border border-dark rounded">
  <div class="row user-status-bar">
    <div class="user-name col-12 border border-success text-center">
      <span>` + a_user.name + `</span>
    </div>
    <div class="user-dice-status col-12 border border-success">
      <div class="row">
        <div class="user-dice-status-4 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>` + status_dice(a_user.dice, 'd4') + `</span>
        </div>
        <div class="user-dice-status-6 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>` + status_dice(a_user.dice, 'd6') + `</span>
        </div>
        <div class="user-dice-status-8 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>` + status_dice(a_user.dice, 'd8') + `</span>
        </div>
        <div class="user-dice-status-10 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>` + status_dice(a_user.dice, 'd10') + `</span>
        </div>
        <div class="user-dice-status-12 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>` + status_dice(a_user.dice, 'd412') + `</span>
        </div>
        <div class="user-dice-status-20 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>` + status_dice(a_user.dice, 'd20') + `</span>
        </div>
        <div class="user-dice-status-total col-12 col-lg-6 col-xl-12 text-center">
          <span>` + status_dice(a_user.dice, 'total') + `</span>
        </div>
      </div>
    </div>
  </div>
  <div class="row user-dice">`;
      for (var die of a_user.dice) {
        dice += `
    <div class="` + die.type + ` bg-` + colors[die.type] + ` p-2 col-4 col-sm-4 col-md-2 col-lg-1 border border-warning mx-auto" style="height: 64px;">
      <span class="bg-light border border-warning center" style="font-size: 2em;">` + ((die.value > -1) ? die.value : '?') + `</span>
    </div>`;
      }
      dice += `
  </div>`;
      if (user.name === a_user.name) {
        dice += `
  <div class="row user-roll">
    <button id="roll" class="btn btn-primary col-7" onClick="roll_dice()">
      <span>Roll</span>
    </button>
    <div class="dropdown col-3 m-0 p-0">
      <button class="btn btn-default dropdown-toggle col-12" type="button" data-toggle="dropdown">
        <span id="dice-type" value="` + dice_type + `">` + dice_type + `<span>
      </button>
      <div class="dropdown-menu" aria-labelledby="dropdownMenuButton">
        <button class="dice-type-select dropdown-item col-12" type="button" onClick="set_dice_type('d4')">d4</button>
        <button class="dice-type-select dropdown-item" type="button" onClick="set_dice_type('d6')">d6</button>
        <button class="dice-type-select dropdown-item" type="button" onClick="set_dice_type('d8')">d8</button>
        <button class="dice-type-select dropdown-item" type="button" onClick="set_dice_type('d10')">d10</button>
        <button class="dice-type-select dropdown-item" type="button" onClick="set_dice_type('d12')">d12</button>
        <button class="dice-type-select dropdown-item" type="button" onClick="set_dice_type('d20')">d20</button>
      </div>
    </div> 
    <button id="add-dice" class="btn btn-success col-1 p-0 m-0" onClick="add_dice()">
      <span>+</span>
    </button>
    <button id="remove-dice" class="btn btn-danger col-1 p-0 m-0" onClick="remove_dice()">
      <span>-</span>
    </button>
  </div>`;
      
      }
      dice += `
</div>`;
    }
    $('#dice').html(dice);
  }
});