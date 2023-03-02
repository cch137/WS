const WS = require('ws');
const fs = require('fs');
const path = require('path');


/**
 * If the time to be processed belongs to RESERVED_EVENTS, it will be handled by the native methods of ws.
 */
const RESERVED_EVENTS = [
  'close',
  'error',
  'message',
  'open',
  'ping',
  'pong',
  'unexpected-response',
  'upgrade'
];

WS.prototype.joinedRooms = new Set();
const wsOn = WS.prototype.on, wsEmit = WS.prototype.emit;

WS.prototype.emit = function(event, data, callback=(err)=>{}, ..._args) {
  const type = event, args = [data, callback, ..._args];

  if (typeof callback != 'function') {
    return wsEmit.call(this, type, ...args);
  }

  if (this.readyState === WS.OPEN) {
    this.send(JSON.stringify({
      event,
      data
    }), callback);
  }
};

WS.prototype.endPending = function(id, event, data, callback=(err)=>{}) {
  if (this.readyState === WS.OPEN) {
    this.send(JSON.stringify({
      event: 'pending',
      data: {
        id, event, data
      }
    }), callback);
  }
};

WS.prototype.on = function(event, handler=(data,pendingId)=>{}) {
  if (RESERVED_EVENTS.includes(event)) {
    return wsOn.call(this, event, handler);
  }
  if (!this.handlers) {
    this.handlers = {};
  }
  let eventHandlerSet = this.handlers[event];

  if (!eventHandlerSet) {
    eventHandlerSet = new Set();
    this.handlers[event] = eventHandlerSet;
  }
  eventHandlerSet.add(handler);

  if (!this.initedWS) {
    wsOn.call(this, 'message', (data) => {
      let event = 'message', pendingId;
      if (data instanceof Buffer) {
        data = data.toString();
      }

      try {
        data = JSON.parse(data);
        event = data.event;
        data = data.data;
      } catch {}

      if (event === 'pending') {
        pendingId = data.id;
        event = data.event;
        data = data.data;
      }

      const handlerSet = this.handlers[event];

      if (handlerSet) {
        handlerSet.forEach(handler => handler(data, pendingId));
      }
    });
    
    this.initedWS = true;
  }
}


class WSRoom {
  constructor(name, key) {
    this.name = name;
    this.key = key;
    this.sockets = new Set();
  }

  addSocket(socket, key) {
    if (this.key && this.key != key) {
      throw new Error('Socket join Room failed: Incorrect key');
    }
    this.sockets.add(socket);
    socket.joinedRooms.add(this);
  }

  removeSocket(socket) {
    this.sockets.delete(socket);
    socket.joinedRooms.delete(this);
  }

  broadcast(event, data) {
    for (const socket of this.sockets) {
      socket.emit(event, data);
    }
  }
}


const wsSvrEmit = WS.Server.prototype.emit;

WS.Server.prototype.emit = function(event, data, callback, ...args) {
  args = [event, data, callback, ...args];
  try {
    if (callback && typeof callback != 'function') {
      throw 'Callback is not a fucntion';
    }
    const message = JSON.stringify({event, data});

    this.clients.forEach(client => {

      if (client.readyState === WS.OPEN) {
        client.send(message);
      }
    });
  } catch {
    wsSvrEmit.call(this, ...args);
  }
};

WS.Server = class WSServer extends WS.Server {
  constructor(options) {
    super(options);
    this.rooms = {};
  }

  joinRoom(socket, roomName, key) {
    let room = this.rooms[roomName];
    if (!this.rooms[roomName]) {
      room = this.rooms[roomName] = new WSRoom(roomName, key);
    }
    room.addSocket(socket, key);
    return room;
  }

  leaveRoom(socket, roomName) {
    const room = this.rooms[roomName];
    if (room) {
      room.removeSocket(socket);
      if (room.sockets.size === 0) {
        delete this.rooms[roomName];
      }
    }
  }

  broadcastRoom(roomName, data) {
    const room = this.rooms[roomName];
    if (room) {
      room.broadcast(data);
    }
  }
}


module.exports = WS;