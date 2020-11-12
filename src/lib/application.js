const { print } = just;
const { createHTTPStream } = require('./net/http.js');
const { createServer } = require('./net/net.js');
const { createResponse } = require('./response.js');

const config = { DEBUG: false };
const maxPipeline = 256;
const stats = { rps: 0, wps: 0, conn: 0 };
let qps = 0;

export default class Application {

    // middleware stack
    middleware = [];

    // register a middleware
    use = (middleware) => {
        this.middleware.push(middleware);
        return this;
    }

    // start the server and listen
    start = () => {
        print("Starting server...");
        createServer(this._onConnect.bind(this)).listen();
        return this;
    }

    // stop the server
    stop = () => {
        // todo: implement killing existing connections
    }


    // Todo: move all this to underlying class...

    // Passes request through middleware stack:
    // -Execute any code.
    // -Make changes to the request and the response objects.
    // -End the request-response cycle.
    // -Call the next middleware in the stack.
    _passRequest = (mwIndex, req, res) => {
        const self = this;
        let mw = this.middleware.length >= mwIndex;
        mw = this.middleware[mwIndex];
        if (mw) {
            mw.handleRequest(req, res, function next() {
                self._passRequest(mwIndex + 1, req, res);
            });
            return true;
        }
        return false;
    }

    _handleRequest = (method, url, socket) => {
        const req = { method, url }, res = createResponse(socket);
        let handled = this._passRequest(0, req, res);
        if (!handled) {
            print("Request not handled: " + url);
            res.end(404);
        }
    }

    _getRequestHeaderParts(stream) {
        let headers = stream.getHeaders().split('\n');
        let pathParts = headers[0].split(' ');
        return { 
            method: pathParts.length ? pathParts[0] : undefined, 
            url:    pathParts.length > 1 ? pathParts[1] : undefined
        }
    }

    _onConnect = (socket) => {
        const self = this;
        stats.conn++;
        const stream = createHTTPStream(socket.buf, maxPipeline);

        socket.onReadable = () => {
            const bytes = socket.pull(stream.offset);
    
            if (bytes <= 0) 
                return;

            const err = stream.parse(bytes, count => {
                qps += count;
                stats.rps += bytes;

                // parse and handle request
                // headers should always exist on initial readable state?
                const { method, url } = self._getRequestHeaderParts(stream);
                if (method && url) {
                    self._handleRequest(method, url, socket);
                } else {
                    // request can't be handled
                    print("malformed request");
                    socket.close();
                }
                //stats.wps += (count * size);
            })
    
            if (err < 0) print(`error: ${err}`)   // Todo: handle app error
        }
    
        socket.onWritable = () => {}
        socket.onEnd = () => stats.conn--;

        return this;
    }

}


