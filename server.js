const express = require("express");

const http = require("http");

const { Server } =
require("socket.io");

const path = require("path");

const fs = require("fs");

/* ======================================================
   APP
====================================================== */

const app = express();

const server =
http.createServer(app);

const io = new Server(server, {

  cors:{
    origin:"*"
  },

 maxHttpBufferSize: 5e6

});

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

/* ======================================================
   USERS
====================================================== */
let registeredUsers = {};
let onlineUsers = {};
try{

  if(fs.existsSync("users.json")){

    const data =
    fs.readFileSync(
      "users.json",
      "utf8"
    );

    registeredUsers =
    data.trim()
    ? JSON.parse(data)
    : {};

  }

}catch{

  registeredUsers = {};

}

function saveUsers(){

  fs.writeFileSync(

    "users.json",

    JSON.stringify(
      registeredUsers,
      null,
      2
    )

  );

}

/* ======================================================
   CHATS
====================================================== */

let chats = {};
try{

  if(fs.existsSync("chats.json")){

    const data =
    fs.readFileSync(
      "chats.json",
      "utf8"
    );

    chats =
    data.trim()
    ? JSON.parse(data)
    : {};

  }

}catch{

  chats = {};

}

function saveChats(){

  fs.writeFileSync(

    "chats.json",

    JSON.stringify(
      chats,
      null,
      2
    )

  );

}

/* ======================================================
   LAST SEEN
====================================================== */

const lastSeen = {};

/* ======================================================
   ROOM
====================================================== */

function getRoom(
  user1,
  user2
){

  return [
    user1,
    user2
  ]
  .sort()
  .join("_");

}

/* ======================================================
   PRESENCE
====================================================== */

function emitPresence(){

  const users = {};

  Object.keys(
    registeredUsers
  ).forEach((user)=>{

    users[user] = {

      online:
      onlineUsers[user]
      ? true
      : false,

      profilePic:

      onlineUsers[user]
      ?.profilePic ||

      registeredUsers[user]
      ?.profilePic ||

      "https://ui-avatars.com/api/?name=User"

    };

  });

  io.emit(
    "presence-update",
    {

      users,

      lastSeen

    }
  );

}

/* ======================================================
   SOCKET
====================================================== */

io.on(
  "connection",
  (socket)=>{

  console.log(
    "Connected:",
    socket.id
  );

  /* ====================================================
     REGISTER
  ==================================================== */
socket.on("register", (data) => {
  if (!data.username || data.username.trim() === "") return;

  const username = data.username.trim();

  socket.username = username;

  // ❌ if already online → disconnect OLD socket first
  if (onlineUsers[username]) {
    const oldSocketId = onlineUsers[username].socketId;

    const oldSocket = io.sockets.sockets.get(oldSocketId);

    if (oldSocket && oldSocket.id !== socket.id) {
      oldSocket.disconnect(true);
    }
  }

  // ✅ overwrite safely (IMPORTANT)
  onlineUsers[username] = {
    socketId: socket.id,
    profilePic:
      data.profilePic ||
      "https://ui-avatars.com/api/?name=User"
  };

  registeredUsers[username] = {
    profilePic:
      data.profilePic ||
      "https://ui-avatars.com/api/?name=User"
  };

  saveUsers();
  emitPresence();
});
  /* ====================================================
     JOIN CHAT
  ==================================================== */

  socket.on(
    "join-private-chat",
    ({from,to})=>{

      const room =
      getRoom(
        from,
        to
      );

      socket.join(room);

      if(
        !chats[room]
      ){

        chats[room] = [];

      }

      const filtered =
      chats[room].filter(
        (msg)=>{

          return (

            !msg.deletedFor ||

            !msg.deletedFor
            .includes(from)

          );

        }
      );

      socket.emit(
        "chat-history",
        filtered
      );

    }
  );

  /* ====================================================
     SEND MESSAGE
  ==================================================== */

  socket.on(
    "send-message",
    (data)=>{

      const room =
      getRoom(
        data.sender,
        data.receiver
      );

      if(!chats[room]){

        chats[room] = [];

      }

      const message = {

        id:
        data.id || Date.now(),

        sender:
        data.sender,

        receiver:
        data.receiver,

        senderPic:
        data.senderPic,

        text:
        data.text || "",

        image:
        data.image || "",

        video:
        data.video || "",

        audio:
        data.audio || "",

        file:
        data.file || "",

        fileName:
        data.fileName || "",

        time:
        data.time,

        replyTo:
        data.replyTo || null,

        reactions:{},

        status:"sent"

      };

      chats[room].push(message);

      saveChats();

      io.to(room).emit(
        "receive-message",
        message
      );

    }
  );

  /* ====================================================
     SEND FILE
  ==================================================== */

  socket.on(
    "send-file",
    (data)=>{

      const room =
      getRoom(
        data.sender,
        data.receiver
      );

      if(
        !chats[room]
      ){

        chats[room] = [];

      }

      const fileMessage = {

        ...data,

        reactions:{},

        status:"sent"

      };

      chats[room]
      .push(fileMessage);

      saveChats();

      io.to(room).emit(
        "receive-file",
        fileMessage
      );

    }
  );

  /* ====================================================
     SEND AUDIO
  ==================================================== */

  socket.on(
    "send-audio",
    (data)=>{

      const room =
      getRoom(
        data.sender,
        data.receiver
      );

      if(
        !chats[room]
      ){

        chats[room] = [];

      }

      const audioMessage = {

        ...data,

        reactions:{},

        status:"sent"

      };

      chats[room]
      .push(audioMessage);

      saveChats();

      io.to(room).emit(
        "receive-audio",
        audioMessage
      );

    }
  );

  /* ====================================================
     MESSAGE DELIVERED
  ==================================================== */
socket.on("message-delivered", ({ room, id }) => {

  const roomChats = chats[room];

  if(!roomChats) return;

  const msg = roomChats.find(
    m => m.id === id
  );

  if(!msg) return;

  if(msg.status === "seen")
  return;

  msg.status = "delivered";

  saveChats();

  io.to(room).emit(
    "message-status-updated",
    {
      id,
      status:"delivered"
    }
  );

});
  /* ====================================================
     MESSAGE SEEN
  ==================================================== */
socket.on("message-seen", ({ room, id }) => {

  const roomChats = chats[room];

  if(!roomChats) return;

  const msg = roomChats.find(
    m => m.id === id
  );

  if(!msg) return;

  // already seen
  if(msg.status === "seen")
  return;

  msg.status = "seen";

  saveChats();

  io.to(room).emit(
    "message-status-updated",
    {
      id,
      status:"seen"
    }
  );

});
  /* ====================================================
     REACTION
  ==================================================== */

  socket.on(
    "add-reaction",
    ({
      room,
      messageId,
      emoji,
      user
    })=>{

      if(
        !chats[room]
      ) return;

      chats[room]
      .forEach((msg)=>{

        if(
          msg.id ===
          messageId
        ){

          if(
            !msg.reactions
          ){

            msg.reactions =
            {};

          }

          if(
            !msg.reactions[
              emoji
            ]
          ){

            msg.reactions[
              emoji
            ] = [];

          }

          if(

            msg.reactions[
              emoji
            ]
            .includes(user)

          ){

            msg.reactions[
              emoji
            ] =

            msg.reactions[
              emoji
            ]
            .filter(
              (u)=>
              u !== user
            );

            if(

              msg.reactions[
                emoji
              ].length === 0

            ){

              delete
              msg.reactions[
                emoji
              ];

            }

          }

          else{

            msg.reactions[
              emoji
            ]
            .push(user);

          }

        }

      });

      saveChats();

      io.to(room)
      .emit(

        "reaction-updated",

        {

          messageId,

          chats:
          chats[room]

        }

      );

    }
  );

  /* ====================================================
     EDIT MESSAGE
  ==================================================== */

  socket.on(
    "edit-message",
    ({
      room,
      id,
      newText
    })=>{

      if(
        !chats[room]
      ) return;

      chats[room]
      .forEach((msg)=>{

        if(
          msg.id === id
        ){

          msg.text =
          newText;

          msg.edited =
          true;

        }

      });

      saveChats();

      io.to(room)
      .emit(

        "message-edited",

        {

          id,

          newText

        }

      );

    }
  );

  /* ====================================================
     DELETE FOR ME
  ==================================================== */

  socket.on(
    "delete-for-me",
    ({
      room,
      id,
      user
    })=>{

      if(
        !chats[room]
      ) return;

      chats[room]
      .forEach((msg)=>{

        if(
          msg.id === id
        ){

          if(
            !msg.deletedFor
          ){

            msg.deletedFor =
            [];

          }

          if(

            !msg.deletedFor
            .includes(user)

          ){

            msg.deletedFor
            .push(user);

          }

        }

      });

      saveChats();

      socket.emit(

        "delete-for-me-success",

        id

      );

    }
  );

  /* ====================================================
     DELETE FOR EVERYONE
  ==================================================== */

  socket.on(
    "delete-for-everyone",
    ({
      room,
      id
    })=>{

      if(
        !chats[room]
      ) return;

      chats[room] =

      chats[room]
      .filter(
        (msg)=>
        msg.id !== id
      );

      saveChats();

      io.to(room)
      .emit(

        "message-deleted",

        id

      );

    }
  );

  /* ====================================================
     CLEAR CHAT
  ==================================================== */

  socket.on(
    "clear-chat-for-me",
    ({
      user,
      withUser
    })=>{

   const room = [
  user,
  withUser
].sort().join("_");

      if(
        !chats[room]
      ) return;

      chats[room]
      .forEach((msg)=>{

        if(
          !msg.deletedFor
        ){

          msg.deletedFor =
          [];

        }

        if(

          !msg.deletedFor
          .includes(user)

        ){

          msg.deletedFor
          .push(user);

        }

      });

      saveChats();

      socket.emit(
        "chat-cleared-for-me"
      );

    }
  );

  /* ====================================================
     PIN MESSAGE
  ==================================================== */

  socket.on(
    "pin-message",
    ({
      room,
      message
    })=>{

      io.to(room)
      .emit(

        "message-pinned",

        message

      );

    }
  );

  /* ====================================================
     TYPING
  ==================================================== */

  socket.on(
    "typing",
    (data)=>{

      const room =
      getRoom(
        data.sender,
        data.receiver
      );

      socket.to(room)
      .emit(
        "typing",
        data
      );

    }
  );

  /* ====================================================
     DISCONNECT
  ==================================================== */

  socket.on(
    "disconnect",
    ()=>{

      const username =
      socket.username;

      if(
        username &&
        onlineUsers[
          username
        ]
      ){

        delete
        onlineUsers[
          username
        ];

        lastSeen[
          username
        ] =

        new Date()
        .toLocaleString();

        emitPresence();

      }

      console.log(
        "Disconnected"
      );

    }
  );

});


/* ======================================================
   SERVER
====================================================== */

const PORT =
process.env.PORT || 3000;

server.listen(
  PORT,
  ()=>{

    console.log(`
===================================
🚀 SERVER RUNNING
http://localhost:${PORT}
===================================
`);

  }
);