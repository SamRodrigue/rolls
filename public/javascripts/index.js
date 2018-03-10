// Elements
var create = {
  modal: '#create-modal',
  form: 'form#create',
  inputs: {
    user_name: '#create-user-name',
    room_name: '#create-room-name',
    admin_password: '#create-admin-password',
    user_password: '#create-user-password'
  },
  submit: '#create-submit'
};
var join = {
  modal: '#join-modal',
  form: 'form#join',
  title: '#join-title',
  inputs: {
    room_id: '#join-room-id',
    user_name: '#join-user-name',
    password: '#join-password'
  },
  submit: '#join-submit',
  labels: {
    password: '#join-label-password'
  },
  buttons: {
    password: '#join-button-password'
  }
};
var rooms = {
  table: 'table#rooms',
  body: '#rooms-body'
};

$(document).ready(function() {
  // Load web socket
  var socket = io();
  
  socket.on('connect', function() {
    console.log('connected');
  });
  socket.on('alert', function(text) { alert(text) });
  socket.on('join-io', function(data) { join_io(data) });
  socket.on('update-rooms', function(data) { update_rooms(data) });
  socket.on('join-room', function(data) { join_room(data) });
  socket.on('disconnect', function() { 
    console.log('disconnected');
  });

  function join_io(data) {
    console.log('joining ' + data);
    socket.emit('join', data);
  }

  function update_rooms(data) {
    console.log('updating rooms');
    var room_table = '';
    for (var [id, room] of data) {
      room_table += '<tr>';
      room_table += '<td class="room-id d-none">' + id + '</td>';
      room_table += '<td class="room-name">' + room.name + '</td>';
      room_table += '<td class="room-users text-center">' + room.users.toString() + '</td>';
      room_table += '<td class="room-locked d-none">' + (room.locked ? "1" : "0") + '</td>';
      room_table += '<td class="text-center"><span class="oi" data-glyph="' + (room.locked ? "lock-locked" : "lock-unlocked") + '"></span></td>';
      room_table += '</tr>';
    }
    $(rooms.body).html(room_table);
  }

  function join_room(id) {
    alert('Joining');
    window.location.href = '/room/' + id;
  }

  // Form: Create Room
  $('button#create-button').on('click', (event) => {
    $(create.modal).modal();
  });

  $(create.form).submit(function() {
    var data = {
      user_name: $(create.inputs.user_name).val(),
      room_name: $(create.inputs.room_name).val(),
      admin_password: $(create.inputs.admin_password).val(),
      user_password: $(create.inputs.user_password).val()
    };
    socket.emit('create-room', data);
    return false;
  });

  // Table: Room-List
  $(rooms.body).on('click', 'tr', function() {
    var room_name = $(this).find('td.room-name').html();
    var room_id = $(this).find('td.room-id').html();
    var room_locked = ($(this).find('td.room-locked').html() == 1);
    
    $(join.title).html('Join: ' + room_name);
    $(join.inputs.room_id).val(room_id);

    if (room_locked) {
      $(join.labels.password).removeClass('d-none');
      $(join.inputs.password).removeClass('d-none');
      $(join.buttons.password).addClass('d-none');
    } else {
      $(join.inputs.password).val('');
      $(join.labels.password).addClass('d-none');
      $(join.inputs.password).addClass('d-none');
      $(join.buttons.password).removeClass('d-none');
    }
    $(join.modal).modal();
  });

  // Form: Join Room
  $(join.buttons.password).on('click', function(event) {
    $(join.buttons.password).addClass('d-none');
    $(join.labels.password).removeClass('d-none');
    $(join.inputs.password).removeClass('d-none');
  });

  $(join.form).submit(function() {
    var data = {
      room_id: $(join.inputs.room_id).val(),
      user_name: $(join.inputs.user_name).val(),
      password: $(join.inputs.password).val()
    };
    socket.emit('join-room', data);
    console.log('Connecting ' + JSON.stringify(data));
    return false;
  });
});