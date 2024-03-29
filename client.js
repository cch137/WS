const $CONNECT = 'connect';
const $DISCONNECT = 'disconnect';
const $ERROR = 'error';
const $RECONNECT = 'reconnect';
const $RECONNECTING = 'reconnecting';
const $RECONNECT_ATTEMPT = 'reconnect_attempt';
const $RECONNECT_ERROR = 'reconnect_error';
const $RECONNECT_FAILED = 'reconnect_failed';

/**
 * @typedef {Object} WSEventData
 * @property {*} data
 * @property {String} [event]
 * @property {Number} [id]
 */

/**
 * @callback WSHandler
 * @param {WSEventData} eventData
 */

class IO {
  /** @type {Boolean} */
  connected = false;

  /** @type {Boolean} */
  connecting = false;

  /** @type {Boolean|NodeJS.Timer|Number} */
  reconnecting = false;

  /** @type {Boolean} */
  autoReconnect = true;

  /** @type {Number} */
  reconnectTries = 0;

  /** @type {Map<String|Number, Function>} */
  handlers = new Map();

  get reserved_events() {
    return [
      $CONNECT,
      $DISCONNECT,
      $ERROR,
      $RECONNECT,
      $RECONNECTING,
      $RECONNECT_ATTEMPT,
      $RECONNECT_ERROR,
      $RECONNECT_FAILED
    ];
  }

  /** @param {Boolean} connectNow */
  constructor(connectNow=true) {
    if (connectNow) this.connect();
  }

  /** @param {String|Number} eventName @param {WSEventData} eventData */
  callListeners(eventName, eventData) {
    if (this.handlers.has(eventName)) {
      this.handlers.get(eventName).forEach(h => {
        try {
          h(eventData);
        } catch (err) {
          console.error(err);
        }
      });
    }
  }
  
  /** @param {String|Number} eventName @param {WSHandler} handler */
  on(eventName, handler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set([handler]));
    } else {
      this.handlers.get(eventName).add(handler);
    }
    if (eventName === $CONNECT) {
      if (this.connected) handler();
    }
  }

  /** @param {String|Number} eventName @param {WSHandler} handler */
  delHandler(eventName, handler) {
    if (this.handlers.has(eventName)) {
      this.handlers.get(eventName).delete(handler);
      if (!this.handlers.get(eventName).size) {
        this.handlers.delete(eventName);
      }
    }
  }

  /** @param {String|Number} eventName */
  clearHandlers(eventName) {
    if (this.handlers.has(eventName)) {
      this.handlers.delete(eventName);
    }
  }
  
  /** @type {Promise<WebSocket>} */
  #connectPromise;
  connect(_resolve) {
    this.#connectPromise = new Promise((resolve, reject) => {
      const self = this;
      if (self.connected || self.connecting) return resolve();
  
      self.autoReconnect = true;
      self.connecting = true;
      if (self.reconnectTries > 1) self.callListeners($RECONNECT_FAILED);
      if (self.reconnecting) self.callListeners($RECONNECT_ATTEMPT);
  
      const ws = new WebSocket(location.origin.replace(/^http/, 'ws'));
  
      ws.onopen = (event) => {
        self.connected = true;
        self.connecting = false;
        if (self.reconnecting) {
          clearInterval(self.reconnecting);
          self.callListeners($RECONNECT, event);
          self.reconnecting = false;
          self.reconnectTries = 0;
        } else {
          self.callListeners($CONNECT, event);
        }
        const waitingList = self.#waitingList.splice(0, self.#waitingList.length);
        waitingList.forEach(args => self.emit(...args));
        resolve(ws);
      };
  
      /** @param {WSEventData} event */
      ws.onmessage = (event) => {
        let eventName = 'message';
        /** @type {WSEventData} */
        let data = event.data;
        try {
          /** @type {WSEventData} */
          const packet = JSON.parse(data);
          if (packet.event === 'pending') {
            eventName = packet.data.id;
            data = packet.data.data;
          } else {
            eventName = packet.event;
            data = packet.data;
          }
        } catch {}
        self.callListeners(eventName, data);
      };
  
      ws.onerror = (err) => {
        if (self.reconnecting) {
          self.callListeners($RECONNECT_ERROR, err);
        } else {
          self.callListeners($ERROR, err);
        }
      };
  
      ws.onclose = (event) => {
        self.connected = false;
        this.connecting = false;
        if (self.autoReconnect) {
          self.connect(resolve)
          .then(() => _resolve ? _resolve(ws) : 0)
          .catch(err => reject(err));
          self.reconnectTries++;
          if (!self.reconnecting) {
            self.reconnecting = setInterval(() => {
              self.callListeners($RECONNECTING);
            }, 0);
          }
        } else reject('Auto-reconnect is disabled');
        self.callListeners($DISCONNECT, event);
      };
      
      delete this.ws;
      this.ws = ws;
    });
    return this.#connectPromise;
  }

  disconnect() {
    if (!this.connected) return;
    this.autoReconnect = false;
    this.ws.close(1000, 'Connection closed by user');
  }

  #waitingList = [];

  /** @param {String} event @param {*} data */
  emit(event, data) {
    if (this.connected) {
      this.ws.send(JSON.stringify({
        event, data
      }));
    } else {
      this.#waitingList.push([event, data]);
    }
  }

  /** @type {Number} */
  #pendingCount = 0;

  /** @param {String} event @param {*} data */
  pending(event, data) {
    return new Promise((resolve, reject) => {
      const id = ++this.#pendingCount;
      this.emit('pending', { id, event, data });
      this.on(id, (data, err) => {
        if (err) reject(err);
        else if (data?.name === 'error') reject(data.data);
        else resolve(data.data);
        this.clearHandlers(id);
      });
    });
  }
}

/** @param {Boolean} connectNow */
const io = (connectNow) => new IO(connectNow);
io.IO = IO;

export default io;