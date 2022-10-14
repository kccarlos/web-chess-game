var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

/////////////////////
// 1. VARIABLES

// each user has one socket stored at the server
var allSockets = {};
// both user shared the same game state
//    socket 1 and 2 uses gamestate 1
//    socket 3 and 4 uses gamestate 2
var allGameStates = {};
// increment user id
var user_count = 0;

/////////////////////
// 2. HELPER FUNCTIONS
function checkLegit(i, j, board_array) {
  // check if the choice is legit
  if (i < 1 || i > 19 || j < 1 || j > 19 || board_array[i][j] != 0) {
    return true;
  }
  return false;
}

function checkwin(whosecheese, board_array) {
  // check if a winner has emerged
  for (var i = 1; i <= 19; i++) {
    for (var j = 1; j <= 19; j++) {
      if (isFiveCenter(i, j, whosecheese, board_array)) {
        return true;
      };
    };
  };
  return false;
};

function isFiveCenter(i, j, whosecheese, board_array) {
  // helper function for checkwin()
  if (
      ( // check left to right. The center piece should be from column 3 to column 17
          i >= 3 && i <= 17 && [board_array[i - 2][j], board_array[i - 1][j], board_array[i][j], board_array[i + 1][j], board_array[i + 2][j]].every(v => v === whosecheese)
      ) || ( // check top to bottom. The center piece should be from row 3 to row 17
          j >= 3 && j <= 17 && [board_array[i][j - 2], board_array[i][j - 1], board_array[i][j], board_array[i][j + 1], board_array[i][j + 2]].every(v => v === whosecheese)
      ) || ( // check diagonal. center piece should be 2 blocks away from 4 boundaries
          i >= 3 && i <= 17 && j >= 3 && j <= 17 && (
              [board_array[i - 2][j - 2], board_array[i - 1][j - 1], board_array[i][j], board_array[i + 1][j + 1], board_array[i + 2][j + 2]].every(v => v === whosecheese) || [board_array[i - 2][j + 2], board_array[i - 1][j + 1], board_array[i][j], board_array[i + 1][j - 1], board_array[i + 2][j - 2]].every(v => v === whosecheese)
          )
      )
  ) {
    return true
  }
  return false
}

/////////////////////
// 3. CONNECTIONS

// set up a static client file
server.listen(8000);
console.log('Please go to http://localhost:8000 to play!')
app.use(express.static('public'));

// set up socket connection
io.on('connection', function(socket) {
  // initiation for a new user
  user_count = user_count + 1;
  socket.clientNum = user_count;
  allSockets[user_count] = socket;
  allGameStates[~~(user_count / 2)] = Array(20).fill().map(() => Array(20).fill(0));
  if (user_count % 2 === 1) {
    // wait for another user
    socket.emit('waiting', user_count);
  } else {
    if (allSockets[user_count - 1]) {
      // another user has connected, start the game
      allSockets[user_count - 1].emit("first");
      socket.emit("latter", user_count);
    }
  }
  socket.on('choose', function(i, j) {
    // get two users socket ID and gamestate
    var sid = socket.clientNum;
    var other_sid = (sid % 2 === 1) ? sid + 1 : sid - 1;
    var gamestate = allGameStates[~~(sid / 2)];
    if (checkLegit(i, j, gamestate)) {
      // detected malicious input from a user. Disconnect both sessions
      allSockets[sid].emit('end');
      allSockets[other_sid].emit('end');
      delete(allSockets[sid]);
      delete(allSockets[other_sid]);
    } else if (checkwin(sid, gamestate)) {
      allSockets[other_sid].emit("youlose");
    } else {
      allSockets[other_sid].emit("choose", i, j);
      gamestate[i][j] = sid;
    }
  });

  socket.on("disconnect", function() {
    // one user disconnected. notify the other user
    var sid = socket.clientNum;
    var other_sid = (sid % 2 === 1) ? sid + 1 : sid - 1;
    // delete state of both users if exists
    delete(allSockets[sid]);
    if (allSockets[other_sid]) {
      allSockets[other_sid].emit('end');
      delete(allSockets[other_sid]);
    }
  });
});