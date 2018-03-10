// Elements
var room_id = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
  
$(document).ready(function() {
  // Load web socket
  var socket = io();

  socket.on('connect', function() {
    console.log('connected to room');
    socket.emit('enter-room', room_id);
  });
  socket.on('alert', function(text) { alert(text) });
  socket.on('room-data', function(data) { room_data(data); });
  socket.on('disconnect', function() { 
      console.log('disconnected');
  });

  function room_data(data) {
    alert(JSON.stringify(data));
    // Add users
    console.log('updating room');
    var dice = '';
    for (var user of data.users) {
      dice += `
<div class="user-area col-12 m-1 border border-dark rounded">
  <div class="row user-status-bar">
    <div class="user-name col-12 border border-success text-center">
      <span>` + user.name + `</span>
    </div>
    <div class="user-dice-status col-12 border border-success">
      <div class="row">
        <div class="user-dice-status-4 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>99d4:999</span>
        </div>
        <div class="user-dice-status-6 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>99d6:999</span>
        </div>
        <div class="user-dice-status-8 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>99d8:999</span>
        </div>
        <div class="user-dice-status-10 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>99d10:999</span>
        </div>
        <div class="user-dice-status-12 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>99d12:9999</span>
        </div>
        <div class="user-dice-status-20 col-6 col-md-4 col-lg-3 col-xl-2">
          <span>99d20:9999</span>
        </div>
        <div class="user-dice-status-total col-12 col-lg-6 col-xl-12 text-center">
          <span>Total: 9999</span>
        </div>
      </div>
    </div>
  </div>
  <div class="row user-dice">
    <div class="dice-4 p-2 col-4 col-sm-4 col-md-2 col-lg-1 border border-warning mx-auto" style="height: 64px;">
      <span class="border border-warning center" style="font-size: 2em;">4</span>
    </div>
  </div>`;
      if (user.name === data.user.name) {
        dice += `
  <div class="row user-roll">
    <button class="btn btn-primary col-12">
      <span>Roll</span>
    </button>
  </div>`;
      
      }
      dice += `
</div>`;
    }
    $('#dice').html(dice);
  }
});