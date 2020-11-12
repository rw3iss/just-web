const maxPipelines = 256; // todo: put in config or #define 
import { getHttpPhrase } from './utils/httpcodes';
import { StatusCodes } from './utils/StatusCodes';

function Response(socket) {
    this.socket = socket;
    return this;
}

// const code_briefs = {
//     400: "OK",
//     403
// }

function _get_brief(status) {
    //const brief 
    return getHttpPhrase(status);
}

Response.prototype.send = function(content, status = StatusCodes.OK) {
    let brief = _get_brief(status);
    let r = `HTTP/1.1 ${status} ${brief}\r\nContent-Length: ${content.length}\r\n\r\n${content}`;
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
