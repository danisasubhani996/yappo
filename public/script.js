const socket = io();
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.querySelector(".sidebar");

menuBtn.addEventListener("click", (e) => {

  e.stopPropagation();

  sidebar.classList.toggle("show");

});

document.addEventListener("click", (e) => {

  if (
    window.innerWidth <= 768 &&
    !sidebar.contains(e.target) &&
    !menuBtn.contains(e.target)
  ) {

    sidebar.classList.remove("show");

  }

});
/* ======================================================
   ELEMENTS
====================================================== */

const messages =
document.getElementById("messages");

const messageInput =
document.getElementById("messageInput");

const sendBtn =
document.getElementById("sendBtn");

const fileBtn =
document.getElementById("fileBtn");

const fileInput =
document.getElementById("fileInput");

const voiceBtn =
document.getElementById("voiceBtn");

const onlineUsersDiv =
document.getElementById("onlineUsers");

const searchUser =
document.getElementById("searchUser");

const chatTitle =
document.getElementById("chatTitle");

const userStatus =
document.getElementById("userStatus");

const clearChatBtn =
document.getElementById("clearChatBtn");

const changeProfileBtn =
document.getElementById("changeProfileBtn");

const profileInput =
document.getElementById("profileInput");

const chatUserPic =
document.getElementById("chatUserPic");

const typingIndicator =
document.getElementById("typingIndicator");

const replyPreview =
document.getElementById("replyPreview");

const replySender =
document.getElementById("replySender");

const replyText =
document.getElementById("replyText");

const cancelReply =
document.getElementById("cancelReply");

const emojiBtn =
document.querySelector(".emoji-btn");

const emojiPanel =
document.getElementById("emojiPanel");

const emojiList =
document.getElementById("emojiList");

const emojiSearch =
document.getElementById("emojiSearch");

const pinnedMessage =
document.getElementById("pinnedMessage");

const themeToggle =
document.getElementById("themeToggle");

const notificationSound =
document.getElementById("notificationSound");

const messageMenu =
document.getElementById("messageMenu");

const reactionPicker =
document.getElementById("reactionPicker");

const forwardModal =
document.getElementById("forwardModal");

const forwardUsers =
document.getElementById("forwardUsers");

const closeForwardModal =
document.getElementById("closeForwardModal");

/* ======================================================
   USER
====================================================== */

let username =
localStorage.getItem("username");

if(!username){

  username =
  prompt("Enter your name");

  if(
    !username ||
    username.trim() === ""
  ){

    username =
    "User" +
    Math.floor(
      Math.random()*9999
    );

  }

  localStorage.setItem(
    "username",
    username
  );

}

/* ======================================================
   VARIABLES
====================================================== */

let currentReceiver = null;

let replyingMessage = null;

let selectedMessage = null;

let allUsersData = {};

let unreadMessages = {};

let mediaRecorder;

let audioChunks = [];

let isRecording = false;

let seenCache = new Set();

let chatsCache = {};

/* ======================================================
   THEME
====================================================== */

if(
  localStorage.getItem(
    "theme"
  ) === "light"
){

  document.body.classList.add(
    "light-mode"
  );

}

themeToggle.onclick = ()=>{

  document.body.classList.toggle(
    "light-mode"
  );

  localStorage.setItem(

    "theme",

    document.body.classList
    .contains("light-mode")

    ? "light"
    : "dark"

  );

};

/* ======================================================
   REGISTER
====================================================== */

socket.emit(
  "register",
  {

    username,

    profilePic:
    localStorage.getItem(
      "profilePic"
    )

  }
);
socket.on(
  "username-taken",
  ()=>{

    alert(
      "Username already online"
    );

    localStorage.removeItem(
      "username"
    );

    location.reload();

  }
);
/* ======================================================
   HELPERS
====================================================== */

function getRoom(){

  return [
    username,
    currentReceiver
  ]
  .sort()
  .join("_");

}

function getTime(){

  return new Date()
  .toLocaleTimeString([],{

    hour:"2-digit",
    minute:"2-digit"

  });

}
function escapeHTML(text){

  const div =
  document.createElement("div");

  div.innerText = text;

  return div.innerHTML;

}

function scrollBottom(){

  messages.scrollTop =
  messages.scrollHeight;

}
searchUser.addEventListener(
  "input",
  ()=>{

    const value =
    searchUser.value
    .toLowerCase();

    document
    .querySelectorAll(".online-user")
    .forEach((user)=>{

      const name =
      user.innerText
      .toLowerCase();

      user.style.display =

      name.includes(value)

      ? "flex"
      : "none";

    });

  }
);
/* ======================================================
   PROFILE
====================================================== */

changeProfileBtn.onclick = ()=>{

  profileInput.click();

};

profileInput.onchange = (e)=>{

  const file =
  e.target.files[0];

  if(!file) return;

  const reader =
  new FileReader();

  reader.onload = ()=>{

    localStorage.setItem(
      "profilePic",
      reader.result
    );

    socket.emit(
      "register",
      {

        username,

        profilePic:
        reader.result

      }
    );

  };

  reader.readAsDataURL(file);

};

/* ======================================================
   EMOJIS
====================================================== */

const emojis = [

"😀","😁","😂","🤣",
"😃","😄","😅","😆",
"😉","😊","😍","😘",
"🥰","😎","😭","🔥",
"❤️","👍","🎉","😡",
"🤔","🐶","🐱","🍔",
"🍕","⚽","🚗","✈️"

];

function loadEmojis(list){

  emojiList.innerHTML = "";

  list.forEach((emoji)=>{

    const span =
    document.createElement(
      "span"
    );

    span.innerText =
    emoji;

    span.onclick = ()=>{

      messageInput.value +=
      emoji;

    };

    emojiList.appendChild(
      span
    );

  });

}

loadEmojis(emojis);

emojiBtn.onclick = ()=>{

  emojiPanel.style.display =

  emojiPanel.style.display
  === "flex"

  ? "none"
  : "flex";

};

emojiSearch.addEventListener(
  "input",
  ()=>{

    const value =
    emojiSearch.value
    .toLowerCase();

    const filtered =
    emojis.filter((e)=>
      e.includes(value)
    );

    loadEmojis(filtered);

  }
);

/* ======================================================
   ADD MESSAGE
====================================================== */
function addMessage(data){

  // prevent duplicates
  const existing =
  document.querySelector(
    `[data-id="${data.id}"]`
  );

  if(existing) return;

  const div =
  document.createElement("div");

  div.className =
  `message ${
    data.sender === username
    ? "sent"
    : "received"
  }`;

  div.dataset.id = data.id;

  div.dataset.sender = data.sender;
  div.dataset.receiver = data.receiver;

  let html = "";

  /* ==========================
     REPLY
  ========================== */

  if(data.replyTo){

    html += `
    <div class="reply-box">
      <small>${data.replyTo.sender}</small>
      <div>${escapeHTML(data.replyTo.text)}</div>
    </div>
    `;

  }

  /* ==========================
     TEXT
  ========================== */

  if(data.text){

    html += `
    <div class="message-text">
      ${escapeHTML(data.text)}

      ${
        data.edited
        ? `<span class="edited-label">edited</span>`
        : ""
      }
    </div>
    `;

  }

  /* ==========================
     IMAGE
  ========================== */

  if(data.image){

    html += `
    <img
      src="${data.image}"
      class="chat-image"
    />
    `;
    setTimeout(() => {
  const img = div.querySelector(".chat-image");

  if (img) {
    img.onclick = () => {
      const viewer = document.getElementById("imageViewer");
      const viewerImg = document.getElementById("viewerImg");

      viewerImg.src = img.src;
      viewer.style.display = "flex";
    };
  }
}, 0);

  }

  /* ==========================
     VIDEO
  ========================== */

  if(data.video){

    html += `
    <video
      controls
      src="${data.video}"
      class="chat-video"
    ></video>
    `;

  }

  /* ==========================
     AUDIO
  ========================== */

  if(data.audio){

    html += `
    <audio
      controls
      src="${data.audio}"
    ></audio>
    `;

  }

  /* ==========================
     FILE
  ========================== */

  if(
    data.file &&
    !data.image &&
    !data.video
  ){

    html += `
   <a
  href="${data.file}"
  download="${data.fileName}"
  class="file-link"
>
  📎 ${data.fileName}
</a>
    `;

  }

  /* ==========================
     REACTIONS
  ========================== */

  html += `
  <div
    class="reactions"
    id="reaction-${data.id}"
  >
  `;

  if(data.reactions){

    Object.entries(
      data.reactions
    ).forEach(([emoji, users])=>{

      html += `
      <span class="reaction-btn">
        ${emoji} ${users.length}
      </span>
      `;

    });

  }

  html += `</div>`;

  /* ==========================
     READ RECEIPTS
  ========================== */

  let ticks = "";

  // ONLY SHOW TICKS FOR MY SENT MSGS
  if(data.sender === username){

    if(data.status === "sent"){

      ticks = "✓";

    }

    else if(data.status === "delivered"){

      ticks = "✓✓";

    }

    else if(data.status === "seen"){

      ticks =
      `<span style="color:#53bdeb;">✓✓</span>`;

    }

  }

  html += `
  <span
    class="time"
    data-status-id="${data.id}"
    data-time="${data.time}"
  >
    ${data.time} ${ticks}
  </span>
  `;

  div.innerHTML = html;

  /* ==========================
     MENU EVENTS
  ========================== */

  div.addEventListener(
    "contextmenu",
    (e)=>{

      e.preventDefault();

      openMenu(
        e.pageX,
        e.pageY,
        data
      );

    }
  );

  div.addEventListener(
    "dblclick",
    (e)=>{

      selectedMessage = data;

      reactionPicker.style.display =
      "flex";

      reactionPicker.style.left =
      `${e.pageX}px`;

      reactionPicker.style.top =
      `${e.pageY}px`;

    }
  );
  let pressTimer;

div.addEventListener(
  "touchstart",
  (e)=>{

    pressTimer =
    setTimeout(()=>{

      openMenu(
        e.touches[0].pageX,
        e.touches[0].pageY,
        data
      );

    },500);

  }
);

div.addEventListener(
  "touchend",
  ()=>{

    clearTimeout(
      pressTimer
    );

  }
);

  messages.appendChild(div);

  scrollBottom();

}

/* ======================================================
   MENU
====================================================== */

function openMenu(x, y, data) {

  selectedMessage = data;

  const menu = messageMenu;

  menu.style.display = "block";

  const menuWidth = 220; // same as CSS min-width
  const menuHeight = 250;

  let left = x;
  let top = y;

  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10;
  }

  if (top + menuHeight > window.innerHeight) {
    top = window.innerHeight - menuHeight - 10;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

document.addEventListener(
  "click",
  ()=>{

    messageMenu.style.display =
    "none";

    reactionPicker.style.display =
    "none";

  }
);

/* ======================================================
   MENU ACTIONS
====================================================== */

messageMenu.onclick = (e)=>{

  const action =
  e.target.dataset.action;

  if(!action) return;

  if(action === "reply"){

    replyingMessage =
    selectedMessage;

    replyPreview.style.display =
    "flex";

    replySender.innerText =
    selectedMessage.sender;

    replyText.innerText =
    selectedMessage.text ||
    "Attachment";

  }

  if(action === "copy"){

    navigator.clipboard.writeText(
      selectedMessage.text || ""
    );

  }

  if(action === "pin"){

    pinnedMessage.style.display =
    "block";

    pinnedMessage.innerText =
    `📌 ${
      selectedMessage.sender
    }: ${
      selectedMessage.text ||
      "Attachment"
    }`;

  }

  if(action === "delete-me"){

    socket.emit(
      "delete-for-me",
      {

        room:getRoom(),

        id:selectedMessage.id,

        user:username

      }
    );

  }

  if(
    action ===
    "delete-everyone"
  ){

    socket.emit(
      "delete-for-everyone",
      {

        room:getRoom(),

        id:selectedMessage.id

      }
    );

  }

  if(action === "forward"){

    forwardModal.style.display =
    "flex";

    forwardUsers.innerHTML = "";

    Object.keys(
      allUsersData.users
    ).forEach((user)=>{

      if(user === username)
      return;

      const div =
      document.createElement(
        "div"
      );

      div.className =
      "forward-user";

      div.innerText =
      user;

      div.onclick = ()=>{

        socket.emit(
          "send-message",
          {

            id:Date.now(),

            sender:username,

            receiver:user,

            senderPic:
            localStorage.getItem(
              "profilePic"
            ),

            text:
            selectedMessage.text,

            image:
            selectedMessage.image,

            video:
            selectedMessage.video,

            audio:
            selectedMessage.audio,

            file:
            selectedMessage.file,

            fileName:
            selectedMessage.fileName,

            forwarded:true,

            time:getTime(),

            status:"sent"

          }
        );

        forwardModal.style.display =
        "none";

      };

      forwardUsers.appendChild(div);

    });

  }

};

/* ======================================================
   REACTIONS
====================================================== */

reactionPicker
.querySelectorAll("span")
.forEach((span)=>{

  span.onclick = ()=>{

    if(!selectedMessage)
    return;

    socket.emit(
      "add-reaction",
      {

        room:getRoom(),

        messageId:
        selectedMessage.id,

        emoji:
        span.innerText,

        user:username

      }
    );

    reactionPicker.style.display =
    "none";

  };

});

/* ======================================================
   SEND MESSAGE
====================================================== */

function sendMessage(){

  if(!currentReceiver)
  return;

  const text =
  messageInput.value.trim();

  if(!text) return;

  const messageData = {

    id:Date.now(),

    sender:username,

    receiver:
    currentReceiver,

    senderPic:
    localStorage.getItem(
      "profilePic"
    ),

    text,

    time:getTime(),

    status:"sent",

    replyTo:
    replyingMessage

    ? {

      sender:
      replyingMessage.sender,

      text:
      replyingMessage.text ||
      "Attachment"

    }

    : null

  };

  addMessage(messageData);

  socket.emit(
    "send-message",
    messageData
  );

  messageInput.value = "";

  replyingMessage = null;

  replyPreview.style.display =
  "none";

}

sendBtn.onclick =
sendMessage;

messageInput.addEventListener(
  "keydown",
  (e)=>{

    if(e.key === "Enter"){

      sendMessage();

    }

  }
);

/* ======================================================
   RECEIVE
====================================================== */
socket.on("receive-message", (data)=>{
  const room = [
  data.sender,
  data.receiver
].sort().join("_");

if(!chatsCache[room]){

  chatsCache[room] = [];

}

chatsCache[room].push(data);

  addMessage(data);

  // ONLY RECEIVER SHOULD PROCESS RECEIPTS
  if(data.sender !== username){

    notificationSound.play();

    // delivered
    if(currentReceiver === data.sender){

      socket.emit(
  "message-delivered",
  {
    room: [
      data.sender,
      data.receiver
    ].sort().join("_"),

    id:data.id
  }
);
      // seen
      if(document.hasFocus()){

        setTimeout(()=>{

          if(!seenCache.has(data.id)){

            seenCache.add(data.id);

            socket.emit(
  "message-seen",
  {
    room:[
      data.sender,
      data.receiver
    ].sort().join("_"),

    id:data.id
  }
);

          }

        },800);

      }

    }

  }

});
/* ======================================================
   HISTORY
====================================================== */
socket.on(
  "chat-history",
  (history)=>{

    messages.innerHTML = "";
    chatsCache[getRoom()] = history;

    history.forEach((msg)=>{

      addMessage(msg);

    });

    // ONLY MARK CURRENT CHAT RECEIVED MSGS AS SEEN
    setTimeout(()=>{
      setTimeout(()=>{

  history.forEach((msg)=>{

    // only received msgs
    if(msg.sender === username)
    return;

    // already seen
    if(msg.status === "seen")
    return;

    if(!seenCache.has(msg.id)){

      seenCache.add(msg.id);

      socket.emit(
        "message-seen",
        {

          room:[
            msg.sender,
            msg.receiver
          ].sort().join("_"),

          id:msg.id

        }
      );

    }

  });

},500);

    },500);

  }
);
/* ======================================================
   STATUS UPDATE
====================================================== */

socket.on(
  "message-status-updated",
  ({ id, status })=>{
// update cache also
Object.values(chatsCache).forEach((chat)=>{

  const msg = chat.find(
    m => m.id === id
  );

  if(msg){

    msg.status = status;

  }

});
    // find exact message
    const messageEl =
    document.querySelector(
      `[data-id="${id}"]`
    );

    if(!messageEl) return;

    // VERY IMPORTANT:
    // update ONLY my sent messages
    if(
      !messageEl.classList.contains(
        "sent"
      )
    ){
      return;
    }

    const timeEl =
    messageEl.querySelector(
      `[data-status-id="${id}"]`
    );

    if(!timeEl) return;

    const time =
    timeEl.dataset.time;

    let ticks = "";

    if(status === "sent"){


      ticks = "✓";

    }

    else if(status === "delivered"){

      ticks = "✓✓";

    }

    else if(status === "seen"){

      ticks =
      `<span style="color:#53bdeb;">✓✓</span>`;

    }

    timeEl.innerHTML =
    `${time} ${ticks}`;

  }
);
/* ======================================================
   WINDOW FOCUS
====================================================== */
window.addEventListener(
  "focus",
  ()=>{

    if(!currentReceiver)
    return;

    const room = getRoom();

    if(!chatsCache[room])
    return;

    chatsCache[room].forEach((msg)=>{

      if(msg.sender === username)
      return;

      if(msg.status === "seen")
      return;

      if(!seenCache.has(msg.id)){

        seenCache.add(msg.id);

        socket.emit(
          "message-seen",
          {
            room,
            id:msg.id
          }
        );

      }

    });

  }
);

/* ======================================================
   USERS
====================================================== */

socket.on(
  "presence-update",
  (data)=>{

    allUsersData = data;

    onlineUsersDiv.innerHTML =
    "";

    Object.keys(
      data.users
    ).forEach((user)=>{

      if(user === username)
      return;

      const userData =
      data.users[user];

      const div =
      document.createElement(
        "div"
      );

      div.className =
      "online-user";
const room = [
  username,
  user
].sort().join("_");

const roomChats =
chatsCache[room] || [];

const lastMsg =
roomChats[
  roomChats.length - 1
];

div.innerHTML = `
<img
  src="${
    userData.profilePic ||
    "https://ui-avatars.com/api/?name=User"
  }"
  class="user-pic"
/>

<div class="user-info">

  <div class="user-top">

    <div class="user-name">
      ${user}
    </div>

    <small class="chat-time">
      ${
        lastMsg
        ? lastMsg.time
        : ""
      }
    </small>

  </div>

  <div class="last-message">

    ${
      lastMsg
      ? (
          lastMsg.text
          || "Attachment"
        )
      : (
          userData.online
          ? "online"
          : "offline"
        )
    }

  </div>

</div>
`;

      div.onclick = ()=>{

        seenCache = new Set();

        currentReceiver =
        user;

        chatTitle.innerText =
        user;

        userStatus.innerText =

        userData.online
        ? "online"
        : "offline";

        chatUserPic.src =

        userData.profilePic ||

        "https://ui-avatars.com/api/?name=User";

        socket.emit(
          "join-private-chat",
          {

            from:username,

            to:user

          }
        );

      };

      onlineUsersDiv
      .appendChild(div);

    });

  }
);

/* ======================================================
   TYPING
====================================================== */

messageInput.addEventListener(
  "input",
  ()=>{

    if(!currentReceiver)
    return;

    socket.emit(
      "typing",
      {

        sender:username,

        receiver:
        currentReceiver

      }
    );

  }
);

socket.on(
  "typing",
  (data)=>{

    typingIndicator.innerText =
    `${data.sender} is typing...`;

    setTimeout(()=>{

      typingIndicator.innerText =
      "";

    },1500);

  }
);

/* ======================================================
   FILE
====================================================== */

fileBtn.onclick = ()=>{

  fileInput.click();

};

fileInput.onchange = (e)=>{

  const file =
  e.target.files[0];

  if(
    !file ||
    !currentReceiver
  ) return;
  if(
  file.size >
  10 * 1024 * 1024
){

  alert(
    "File too large (max 10MB)"
  );

  return;

}


  const reader =
  new FileReader();

  reader.onload = ()=>{

    const data = {

      id:Date.now(),

      sender:username,

      receiver:
      currentReceiver,

      senderPic:
      localStorage.getItem(
        "profilePic"
      ),

      file:reader.result,

      fileName:file.name,

      time:getTime(),

      status:"sent"

    };

    if(
      file.type.startsWith(
        "image"
      )
    ){

      data.image =
      reader.result;

    }

    else if(
      file.type.startsWith(
        "video"
      )
    ){

      data.video =
      reader.result;

    }

   const exists =
document.querySelector(
  `[data-id="${data.id}"]`
);

if(!exists){

  addMessage(data);

}

    socket.emit(
      "send-file",
      data
    );

  };

  reader.readAsDataURL(file);

};

socket.on(
  "receive-file",
  (data)=>{

    addMessage(data);

    // ONLY RECEIVER
    if(data.sender !== username){

      notificationSound.play();

      if(currentReceiver === data.sender){

        // delivered
        socket.emit(
          "message-delivered",
          {
            room:[
              data.sender,
              data.receiver
            ].sort().join("_"),

            id:data.id
          }
        );

        // seen
        if(document.hasFocus()){

          setTimeout(()=>{

            if(!seenCache.has(data.id)){

              seenCache.add(data.id);

              socket.emit(
                "message-seen",
                {
                  room:[
                    data.sender,
                    data.receiver
                  ].sort().join("_"),

                  id:data.id
                }
              );

            }

          },800);

        }

      }

    }

  }
);

/* ======================================================
   AUDIO
====================================================== */

async function startRecording(){

  try{

    const stream =
    await navigator
    .mediaDevices
    .getUserMedia({
      audio:true
    });

    mediaRecorder =
    new MediaRecorder(stream);

    audioChunks = [];

    mediaRecorder.ondataavailable =
    (e)=>{

      if(
        e.data.size > 0
      ){

        audioChunks.push(
          e.data
        );

      }

    };

    mediaRecorder.onstop =
    ()=>{
stream.getTracks().forEach(
  track => track.stop()
);
      const blob =
      new Blob(
        audioChunks,
        {
          type:"audio/webm"
        }
        
      );

      const reader =
      new FileReader();

      reader.onloadend =
      ()=>{

        const data = {

          id:Date.now(),

          sender:username,

          receiver:
          currentReceiver,

          senderPic:
          localStorage.getItem(
            "profilePic"
          ),

          audio:
          reader.result,

          time:getTime(),

          status:"sent"

        };

        const exists =
document.querySelector(
  `[data-id="${data.id}"]`
);

if(!exists){

  addMessage(data);

}

        socket.emit(
          "send-audio",
          data
        );

      };

      reader.readAsDataURL(
        blob
      );

    };

    mediaRecorder.start();

    isRecording = true;

    voiceBtn.innerHTML =
    `<i class="fa-solid fa-stop"></i>`;

  }

  catch(err){

    alert(
      "Mic permission denied"
    );

  }

}

function stopRecording(){

  mediaRecorder.stop();

  isRecording = false;

  voiceBtn.innerHTML =
  `<i class="fa-solid fa-microphone"></i>`;

}

voiceBtn.onclick = ()=>{

  if(!currentReceiver){

    alert(
      "Select user first"
    );

    return;

  }

  if(!isRecording){

    startRecording();

  }

  else{

    stopRecording();

  }

};

socket.on(
  "receive-audio",
  (data)=>{

    addMessage(data);

    // ONLY RECEIVER
    if(data.sender !== username){

      notificationSound.play();

      if(currentReceiver === data.sender){

        // delivered
        socket.emit(
          "message-delivered",
          {
            room:[
              data.sender,
              data.receiver
            ].sort().join("_"),

            id:data.id
          }
        );

        // seen
        if(document.hasFocus()){

          setTimeout(()=>{

            if(!seenCache.has(data.id)){

              seenCache.add(data.id);

              socket.emit(
                "message-seen",
                {
                  room:[
                    data.sender,
                    data.receiver
                  ].sort().join("_"),

                  id:data.id
                }
              );

            }

          },800);

        }

      }

    }

  }
);

/* ======================================================
   DELETE
====================================================== */

socket.on(
  "message-deleted",
  (id)=>{

    const msg =
    document.querySelector(
      `[data-id="${id}"]`
    );

    if(msg){

      msg.remove();

    }

  }
);

socket.on(
  "delete-for-me-success",
  (id)=>{

    const msg =
    document.querySelector(
      `[data-id="${id}"]`
    );

    if(msg){

      msg.remove();

    }

  }
);

/* ======================================================
   REACTIONS UPDATE
====================================================== */

socket.on(
  "reaction-updated",
  ({ messageId, chats }) => {

    const msg =
    chats.find(
      m => m.id === messageId
    );

    if(!msg) return;

    const reactionDiv =
    document.getElementById(
      `reaction-${messageId}`
    );

    if(!reactionDiv)
    return;

    reactionDiv.innerHTML = "";

    if(msg.reactions){

      Object.entries(
        msg.reactions
      ).forEach(([emoji, users])=>{

        reactionDiv.innerHTML += `
        <span class="reaction-btn">
          ${emoji} ${users.length}
        </span>
        `;

      });

    }

  }
);

/* ======================================================
   PIN
====================================================== */

socket.on(
  "message-pinned",
  (message)=>{

    pinnedMessage.style.display =
    "block";

    pinnedMessage.innerText =
    `📌 ${message.sender}: ${
      message.text ||
      "Attachment"
    }`;

  }
);

/* ======================================================
   EDIT
====================================================== */

socket.on(
  "message-edited",
  ({id,newText})=>{

    const msg =
    document.querySelector(
      `[data-id="${id}"] .message-text`
    );

    if(msg){

      msg.innerHTML = `
      ${newText}

      <span class="edited-label">
      edited
      </span>
      `;

    }

  }
);

/* ======================================================
   CLEAR CHAT
====================================================== */

clearChatBtn.onclick = ()=>{

  if(!currentReceiver)
  return;

  socket.emit(
    "clear-chat-for-me",
    {

      user:username,

      withUser:
      currentReceiver

    }
  );

};

socket.on(
  "chat-cleared-for-me",
  ()=>{

    messages.innerHTML =
    "";

  }
);

/* ======================================================
   CLOSE MODAL
====================================================== */

closeForwardModal.onclick =
()=>{

  forwardModal.style.display =
  "none";

};

/* ======================================================
   CANCEL REPLY
====================================================== */

cancelReply.onclick = ()=>{

  replyingMessage = null;

  replyPreview.style.display =
  "none";

};

document.addEventListener("click", (e) => {

  if (e.target.classList.contains("chat-image")) {

    const viewer = document.getElementById("imageViewer");
    const img = document.getElementById("viewerImg");

    img.src = e.target.src;
    viewer.style.display = "flex";
  }

  if (e.target.id === "imageViewer") {
    e.target.style.display = "none";
  }

});
document.addEventListener("click", (e) => {

  if (!emojiPanel.contains(e.target) &&
      !emojiBtn.contains(e.target)) {
    emojiPanel.style.display = "none";
  }

});
const imageViewer =
document.getElementById("imageViewer");

const closeViewer =
document.getElementById("closeViewer");

closeViewer.onclick = () => {

  imageViewer.style.display =
  "none";

};

imageViewer.onclick = (e) => {

  if (
    e.target === imageViewer
  ) {

    imageViewer.style.display =
    "none";

  }

};