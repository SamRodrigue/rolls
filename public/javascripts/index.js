$(document).ready(function() {
  // Load Socket
  var socket = io();

  socket.on('alert', function(text) {
    alert(text);
  });
  
  socket.on('rooms', function(rooms) {
    var room_table = '';
    for (var [id, room] of rooms) {
      room_table += '<tr>';
      room_table += '<td class="room-id d-none">' + id + '</td>';
      room_table += '<td class="room-name">' + room.name + '</td>';
      room_table += '<td class="room-users text-center">' + room.users.toString() + '</td>';
      room_table += '<td class="room-locked d-none">' + (room.locked ? "1" : "0") + '</td>';
      room_table += '<td class="text-center"><span class="oi" data-glyph="' + (room.locked ? "lock-locked" : "lock-unlocked") + '"></span></td>';
      room_table += '</tr>';
    }

    $('#room-list tbody').html(room_table);
  });

  socket.on('join', function(id) {
    alert('Joining');
    window.location.href = '/room/' + id;
  });

  $('#create-button').on('click', function(event) {
    $('#create-modal').modal();
  });

  $('form#create-form').submit(function() {
    var create_req = {
      username: $(this).find('input#username').val(),
      room_name: $(this).find('input#room-name').val(),
      admin_password: $(this).find('input#admin-password').val(),
      user_password: $(this).find('input#user-password').val()
    };

    socket.emit('create', create_req);
    console.log('Creating');
    return false;
  });

  $('#room-list').on('click', 'tbody tr', function(event) {
    var room_name = $(this).find('td.room-name').html();
    var room_id = $(this).find('td.room-id').html();
    var room_locked = ($(this).find('td.room-locked').html() == 1);
    
    var connect = $('#connect-modal');
    connect.find('#form-title').html(room_name);
    connect.find('#room-id').val(room_id);

    if (room_locked) {
      connect.find('label#password-label').removeClass('d-none');
      connect.find('input#password').removeClass('d-none');
      connect.find('button#password-login').addClass('d-none');
    } else {
      connect.find('input#password').val('');
      connect.find('label#password-label').addClass('d-none');
      connect.find('input#password').addClass('d-none');
      connect.find('button#password-login').removeClass('d-none');
    }

    $('#connect-modal').modal();
  });

  $('#connect-modal button#password-login').on('click', function(event) {
    var connect = $('#connect-modal');
    connect.find('label#password-label').removeClass('d-none');
    connect.find('input#password').removeClass('d-none');
    connect.find('button#password-login').addClass('d-none');
  });

  $('form#connect-form').submit(function() {
    var join_req = {
      room_id: $(this).find('input#room-id').val(),
      username: $(this).find('input#username').val(),
      password: $(this).find('input#password').val()
    };

    socket.emit('join', join_req);
    console.log('Connecting');
    return false;
  });
});