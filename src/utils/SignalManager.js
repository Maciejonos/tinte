export class SignalManager {
  constructor() {
    this._connections = [];
  }

  connect(widget, signal, callback) {
    const id = widget.connect(signal, callback);
    this._connections.push({ widget, id });
    return id;
  }

  disconnectAll() {
    this._connections.forEach(({ widget, id }) => {
      if (widget && id) {
        widget.disconnect(id);
      }
    });
    this._connections = [];
  }
}
