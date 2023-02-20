
# Introduction

This module extends the functionality of the  `ws`  library, adding support for emitting and handling events, as well as creating and managing WebSocket rooms.

## Classes and Prototypes

### WS

The  `WS`  prototype is the  `WebSocket`  instance returned by  `ws.Server`. This prototype has been extended to support emitting and handling events.

#### Properties

-   `joinedRooms: *Set*`: a set of rooms that the socket has joined.
    
-   `handlers = {}`: an object that maps event names to sets of event handlers.
    

#### Methods

-   `on(event: *string*, handler: *Function*)`: adds an event handler for a specific event. If the event name is one of the reserved events (‘close’, ‘error’, ‘message’, ‘open’, ‘ping’, ‘pong’, ‘unexpected-response’, ‘upgrade’), the original  `on`  method will be used. Otherwise, the event handler will be added to the  `handlers`  object.
    
-   `emit(event: *string*, data: *any*, callback: *Function*)`: sends an event to the socket. The  `callback`  function is called once the message has been sent, or immediately if the socket is not open. The  `callback`  function takes an optional  `err`  parameter.
    
-   `__on`  and  `__emit`: the original  `on`  and  `emit`  methods of the WebSocket instance, which are called when handling reserved events or if an error occurs.
    

### WS.Server

The  `WS.Server`  class extends the  `ws.Server`  class, adding support for creating and managing WebSocket rooms.

#### Properties

-   `rooms = {}`: an object that contains all the rooms created by the server, with room names as keys and  `WSRoom`  objects as values.

#### Methods

-   `joinRoom(socket: *WS*, roomName: *string*, key: *string*)`: joins a socket to a room. A room with the given name is created if it doesn’t exist.  `key`  is an optional string that is used to authenticate the socket joining the room.
    
-   `leaveRoom(socket: *WS*, roomName: *string*)`: removes a socket from a room. If the room has no sockets after removing the socket, the room is deleted.
    
-   `broadcastRoom(roomName: *WS*, data: *any*)`: broadcasts a message to all sockets in a room.
    

### WSRoom

The  `WSRoom`  class represents a WebSocket room.

#### Properties

-   `name: *string*`: the name of the room.
    
-   `key: *string*`: an optional string used to authenticate sockets joining the room.
    
-   `sockets: *WS*`: a set of sockets that have joined the room.
    

#### Methods

-   `addSocket(socket: *WS*, key: *string*)`: adds a socket to the room. The given key must match the room’s key, otherwise an error is thrown.
    
-   `removeSocket(socket: *WS*)`: removes a socket from the room.
    
-   `broadcast(event: *string*, data: *any*)`: broadcasts an event to all sockets in the room.
    

# For developer of this module

## Commands

### 運行

```
npm run i

```

### 推送 Repository

```
git pull
git add .
git commit -am "updated"
git push

```

### 開發初始化

```
npm i --save-dev @types/node
npm i

```