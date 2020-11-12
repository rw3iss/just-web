const maxPipelines = 256; // todo: put in config or #define 
import { getHttpPhrase } from './utils/httpcodes';

function Response(socket) {
    this.socket = socket;
    return this;
}

Response.prototype.send = function(content, status = 200) {
    let r = `HTTP/1.1 ${status} ${getHttpPhrase(status)}\r\nContent-Length: ${content.length}\r\n\r\n${content}`;
    let buf = ArrayBuffer.fromString(r.repeat(maxPipelines));

    if (this.socket.write(buf, r.length) <= 0) 
        return;

    this.socket.close();
};

Response.prototype.json = function(object, status = 200) {
    let jm = JSON.stringify(object); // todo: use safe-stringify?
    this.send(jm);
}

Response.prototype.end = function(status = 200) {
    this.send('', status);
    this.socket.close();
}

function createResponse(socket) {
    return new Response(socket);
}

module.exports = { createResponse }
