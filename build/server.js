(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
  var __commonJS = (callback, module) => () => {
    if (!module) {
      module = {exports: {}};
      callback(module.exports, module);
    }
    return module.exports;
  };
  var __exportStar = (target, module, desc) => {
    __markAsModule(target);
    if (typeof module === "object" || typeof module === "function") {
      for (let key of __getOwnPropNames(module))
        if (!__hasOwnProp.call(target, key) && key !== "default")
          __defProp(target, key, {get: () => module[key], enumerable: !(desc = __getOwnPropDesc(module, key)) || desc.enumerable});
    }
    return target;
  };
  var __toModule = (module) => {
    if (module && module.__esModule)
      return module;
    return __exportStar(__defProp(__create(__getProtoOf(module)), "default", {value: module, enumerable: true}), module);
  };

  // src/lib/net/http.js
  var require_http = __commonJS((exports, module) => {
    const MIN_REQUEST_SIZE = 16;
    function createHTTPStream2(buf = new ArrayBuffer(4096), maxPipeline2 = 256, off = 0) {
      let offset = off;
      const dv = new DataView(buf);
      const bufLen = buf.byteLength;
      const offsets = new Uint16Array(Math.floor(buf.byteLength / MIN_REQUEST_SIZE));
      function parse(bytes, onRequests) {
        if (bytes === 0)
          return;
        const size = offset + bytes;
        const len = Math.min(size, bufLen);
        let off2 = 0;
        let count = 0;
        const end = len - 3;
        for (; off2 < end; off2++) {
          if (dv.getUint32(off2, true) === 168626701) {
            offsets[count++] = off2 + 4;
            off2 += 3;
          }
        }
        offsets[count] = off2;
        if (count > 0) {
          onRequests(count);
          if (off2 < size) {
            offset = size - off2;
            buf.copyFrom(buf, 0, offset, off2);
          } else {
            offset = 0;
          }
        } else {
          if (size === buf.byteLength) {
            return -3;
          }
          offset = size;
        }
        return offset;
      }
      function getHeaders(index = 0) {
        if (index === 0) {
          return buf.readString(offsets[index], 0);
        }
        return buf.readString(offsets[index] - offsets[index - 1], offsets[index - 1]);
      }
      return {parse, getHeaders};
    }
    module.exports = {createHTTPStream: createHTTPStream2};
  });

  // src/lib/net/net.js
  var require_net = __commonJS((exports, module) => {
    const {sys, net} = just;
    const {EPOLLERR, EPOLLIN, EPOLLOUT, EPOLLHUP} = just.loop;
    const {IPPROTO_TCP, O_NONBLOCK, TCP_NODELAY, SO_KEEPALIVE, SOMAXCONN, AF_INET, SOCK_STREAM, SOL_SOCKET, SO_REUSEADDR, SO_REUSEPORT, SOCK_NONBLOCK} = net;
    const {loop} = just.factory;
    const config = {BUFFER_SIZE: 65536, PORT: 3e3};
    function createSocket(fd, buf, onClose) {
      const socket = {fd, buf};
      socket.pull = (off = 0) => {
        const bytes = net.recv(fd, buf, off);
        if (bytes > 0)
          return bytes;
        if (bytes < 0) {
          const errno = sys.errno();
          if (errno !== net.EAGAIN) {
            just.print(sys.strerror(errno));
            onClose(fd);
          }
          return bytes;
        }
        onClose(fd);
        return 0;
      };
      socket.pause = () => loop.update(fd, EPOLLOUT);
      socket.write = (buf2, len) => {
        const r = net.send(fd, buf2, len);
        if (r < 0) {
          const errno = sys.errno();
          if (errno === net.EAGAIN) {
            socket.pause();
            return 0;
          }
          just.print(`write: (${errno}) ${sys.strerror(errno)}`);
          socket.close();
          return r;
        }
        if (r === 0) {
          just.print("zero bytes");
          socket.close();
          return -1;
        }
        return r;
      };
      socket.onReadable = socket.onWritable = socket.onEnd = () => {
      };
      socket.close = () => net.close(fd);
      return socket;
    }
    function createServer2(onConnect, opts = {bufSize: config.BUFFER_SIZE}) {
      const clients = {};
      const server = Object.assign({
        maxPipeline: 256,
        reuseAddress: true,
        reusePort: true
      }, opts);
      const fd = net.socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0);
      function closeSocket(fd2) {
        clients[fd2].onEnd();
        delete clients[fd2];
        net.close(fd2);
      }
      ;
      function onSocketEvent(fd2, event) {
        if (event & EPOLLERR || event & EPOLLHUP) {
          closeSocket(fd2);
          return;
        }
        if (event & EPOLLIN) {
          clients[fd2].onReadable();
          return;
        }
        if (event & EPOLLOUT) {
          loop.update(fd2, EPOLLIN);
          clients[fd2].onWritable();
        }
      }
      ;
      function onListenEvent(fd2, event) {
        const clientfd = net.accept(fd2);
        net.setsockopt(clientfd, IPPROTO_TCP, TCP_NODELAY, 1);
        net.setsockopt(clientfd, SOL_SOCKET, SO_KEEPALIVE, 1);
        let flags = sys.fcntl(clientfd, sys.F_GETFL, 0);
        flags |= O_NONBLOCK;
        sys.fcntl(clientfd, sys.F_SETFL, flags);
        loop.add(clientfd, onSocketEvent);
        const sock = createSocket(clientfd, new ArrayBuffer(opts.bufSize), closeSocket);
        clients[clientfd] = sock;
        onConnect(sock);
      }
      ;
      if (fd <= 0)
        throw new Error(`Failed Creating Socket: ${sys.strerror(sys.errno())}`);
      if (server.reuseAddress && net.setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, 1) !== 0)
        throw new Error(`Failed Setting Reuse Address Socket Option: ${sys.strerror(sys.errno())}`);
      if (server.reusePort && net.setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, 1) !== 0)
        throw new Error(`Failed Setting Reuse Port Socket Option: ${sys.strerror(sys.errno())}`);
      server.listen = (address = "127.0.0.1", port = config.PORT, maxconn = SOMAXCONN) => {
        if (net.bind(fd, address, port) !== 0)
          throw new Error(`Failed Binding Socket: ${sys.strerror(sys.errno())}`);
        if (net.listen(fd, maxconn) !== 0)
          throw new Error(`Failed Listening on Socket: ${sys.strerror(sys.errno())}`);
        loop.add(fd, onListenEvent);
        return server;
      };
      return server;
    }
    function createClient(onConnect, opts = {bufSize: config.BUFFER_SIZE}) {
      const fd = net.socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0);
      if (fd <= 0)
        throw new Error(`Failed Creating Socket: ${sys.strerror(sys.errno())}`);
      const sock = {fd, connected: false};
      function onSocketEvent(fd2, event) {
        if (event & EPOLLOUT) {
          if (!sock.connected) {
            sock.connected = true;
            onConnect(sock);
          }
          loop.update(fd2, EPOLLIN);
          sock.onWritable();
        }
        if (event & EPOLLERR || event & EPOLLHUP) {
          just.print("err");
          return net.close(fd2);
        }
        if (event & EPOLLIN)
          return sock.onReadable();
      }
      ;
      sock.connect = (address = "127.0.0.1", port = config.PORT) => {
        const r = net.connect(fd, address, port);
        if (r !== 0) {
          const errno = sys.errno();
          if (errno !== 115) {
            throw new Error(`Failed Connecting: ${sys.strerror(errno)}`);
          }
        }
        net.setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, 1);
        net.setsockopt(fd, SOL_SOCKET, SO_KEEPALIVE, 1);
        loop.add(fd, onSocketEvent, EPOLLOUT);
        return Object.assign(sock, createSocket(fd, new ArrayBuffer(opts.bufSize), () => net.close(fd)));
      };
      return sock;
    }
    module.exports = {createServer: createServer2, createClient, config};
  });

  // src/lib/utils/http_codes.json
  var require_http_codes = __commonJS((exports, module) => {
    module.exports = [
      {
        code: 202,
        phrase: "Accepted",
        constant: "ACCEPTED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.3",
          description: "The request has been received but not yet acted upon. It is non-committal, meaning that there is no way in HTTP to later send an asynchronous response indicating the outcome of processing the request. It is intended for cases where another process or server handles the request, or for batch processing."
        }
      },
      {
        code: 502,
        phrase: "Bad Gateway",
        constant: "BAD_GATEWAY",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.3",
          description: "This error response means that the server, while working as a gateway to get a response needed to handle the request, got an invalid response."
        }
      },
      {
        code: 400,
        phrase: "Bad Request",
        constant: "BAD_REQUEST",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.1",
          description: "This response means that server could not understand the request due to invalid syntax."
        }
      },
      {
        code: 409,
        phrase: "Conflict",
        constant: "CONFLICT",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.8",
          description: "This response is sent when a request conflicts with the current state of the server."
        }
      },
      {
        code: 100,
        phrase: "Continue",
        constant: "CONTINUE",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.2.1",
          description: "This interim response indicates that everything so far is OK and that the client should continue with the request or ignore it if it is already finished."
        }
      },
      {
        code: 201,
        phrase: "Created",
        constant: "CREATED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.2",
          description: "The request has succeeded and a new resource has been created as a result of it. This is typically the response sent after a PUT request."
        }
      },
      {
        code: 417,
        phrase: "Expectation Failed",
        constant: "EXPECTATION_FAILED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.14",
          description: "This response code means the expectation indicated by the Expect request header field can't be met by the server."
        }
      },
      {
        code: 424,
        phrase: "Failed Dependency",
        constant: "FAILED_DEPENDENCY",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.5",
          description: "The request failed due to failure of a previous request."
        }
      },
      {
        code: 403,
        phrase: "Forbidden",
        constant: "FORBIDDEN",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.3",
          description: "The client does not have access rights to the content, i.e. they are unauthorized, so server is rejecting to give proper response. Unlike 401, the client's identity is known to the server."
        }
      },
      {
        code: 504,
        phrase: "Gateway Timeout",
        constant: "GATEWAY_TIMEOUT",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.5",
          description: "This error response is given when the server is acting as a gateway and cannot get a response in time."
        }
      },
      {
        code: 410,
        phrase: "Gone",
        constant: "GONE",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.9",
          description: 'This response would be sent when the requested content has been permenantly deleted from server, with no forwarding address. Clients are expected to remove their caches and links to the resource. The HTTP specification intends this status code to be used for "limited-time, promotional services". APIs should not feel compelled to indicate resources that have been deleted with this status code.'
        }
      },
      {
        code: 505,
        phrase: "HTTP Version Not Supported",
        constant: "HTTP_VERSION_NOT_SUPPORTED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.6",
          description: "The HTTP version used in the request is not supported by the server."
        }
      },
      {
        code: 418,
        phrase: "I'm a teapot",
        constant: "IM_A_TEAPOT",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc2324#section-2.3.2",
          description: `Any attempt to brew coffee with a teapot should result in the error code "418 I'm a teapot". The resulting entity body MAY be short and stout.`
        }
      },
      {
        code: 419,
        phrase: "Insufficient Space on Resource",
        constant: "INSUFFICIENT_SPACE_ON_RESOURCE",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.6",
          description: "The 507 (Insufficient Storage) status code means the method could not be performed on the resource because the server is unable to store the representation needed to successfully complete the request. This condition is considered to be temporary. If the request which received this status code was the result of a user action, the request MUST NOT be repeated until it is requested by a separate user action."
        }
      },
      {
        code: 507,
        phrase: "Insufficient Storage",
        constant: "INSUFFICIENT_STORAGE",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.6",
          description: "The server has an internal configuration error: the chosen variant resource is configured to engage in transparent content negotiation itself, and is therefore not a proper end point in the negotiation process."
        }
      },
      {
        code: 500,
        phrase: "Internal Server Error",
        constant: "INTERNAL_SERVER_ERROR",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.1",
          description: "The server encountered an unexpected condition that prevented it from fulfilling the request."
        }
      },
      {
        code: 411,
        phrase: "Length Required",
        constant: "LENGTH_REQUIRED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.10",
          description: "The server rejected the request because the Content-Length header field is not defined and the server requires it."
        }
      },
      {
        code: 423,
        phrase: "Locked",
        constant: "LOCKED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.4",
          description: "The resource that is being accessed is locked."
        }
      },
      {
        code: 420,
        phrase: "Method Failure",
        constant: "METHOD_FAILURE",
        isDeprecated: true,
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/rfcdiff?difftype=--hwdiff&url2=draft-ietf-webdav-protocol-06.txt",
          description: "A deprecated response used by the Spring Framework when a method has failed."
        }
      },
      {
        code: 405,
        phrase: "Method Not Allowed",
        constant: "METHOD_NOT_ALLOWED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.5",
          description: "The request method is known by the server but has been disabled and cannot be used. For example, an API may forbid DELETE-ing a resource. The two mandatory methods, GET and HEAD, must never be disabled and should not return this error code."
        }
      },
      {
        code: 301,
        phrase: "Moved Permanently",
        constant: "MOVED_PERMANENTLY",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.2",
          description: "This response code means that URI of requested resource has been changed. Probably, new URI would be given in the response."
        }
      },
      {
        code: 302,
        phrase: "Moved Temporarily",
        constant: "MOVED_TEMPORARILY",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.3",
          description: "This response code means that URI of requested resource has been changed temporarily. New changes in the URI might be made in the future. Therefore, this same URI should be used by the client in future requests."
        }
      },
      {
        code: 207,
        phrase: "Multi-Status",
        constant: "MULTI_STATUS",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.2",
          description: "A Multi-Status response conveys information about multiple resources in situations where multiple status codes might be appropriate."
        }
      },
      {
        code: 300,
        phrase: "Multiple Choices",
        constant: "MULTIPLE_CHOICES",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.1",
          description: "The request has more than one possible responses. User-agent or user should choose one of them. There is no standardized way to choose one of the responses."
        }
      },
      {
        code: 511,
        phrase: "Network Authentication Required",
        constant: "NETWORK_AUTHENTICATION_REQUIRED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc6585#section-6",
          description: "The 511 status code indicates that the client needs to authenticate to gain network access."
        }
      },
      {
        code: 204,
        phrase: "No Content",
        constant: "NO_CONTENT",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.5",
          description: "There is no content to send for this request, but the headers may be useful. The user-agent may update its cached headers for this resource with the new ones."
        }
      },
      {
        code: 203,
        phrase: "Non Authoritative Information",
        constant: "NON_AUTHORITATIVE_INFORMATION",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.4",
          description: "This response code means returned meta-information set is not exact set as available from the origin server, but collected from a local or a third party copy. Except this condition, 200 OK response should be preferred instead of this response."
        }
      },
      {
        code: 406,
        phrase: "Not Acceptable",
        constant: "NOT_ACCEPTABLE",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.6",
          description: "This response is sent when the web server, after performing server-driven content negotiation, doesn't find any content following the criteria given by the user agent."
        }
      },
      {
        code: 404,
        phrase: "Not Found",
        constant: "NOT_FOUND",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.4",
          description: "The server can not find requested resource. In the browser, this means the URL is not recognized. In an API, this can also mean that the endpoint is valid but the resource itself does not exist. Servers may also send this response instead of 403 to hide the existence of a resource from an unauthorized client. This response code is probably the most famous one due to its frequent occurence on the web."
        }
      },
      {
        code: 501,
        phrase: "Not Implemented",
        constant: "NOT_IMPLEMENTED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.2",
          description: "The request method is not supported by the server and cannot be handled. The only methods that servers are required to support (and therefore that must not return this code) are GET and HEAD."
        }
      },
      {
        code: 304,
        phrase: "Not Modified",
        constant: "NOT_MODIFIED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7232#section-4.1",
          description: "This is used for caching purposes. It is telling to client that response has not been modified. So, client can continue to use same cached version of response."
        }
      },
      {
        code: 200,
        phrase: "OK",
        constant: "OK",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.1",
          description: "The request has succeeded. The meaning of a success varies depending on the HTTP method:\nGET: The resource has been fetched and is transmitted in the message body.\nHEAD: The entity headers are in the message body.\nPOST: The resource describing the result of the action is transmitted in the message body.\nTRACE: The message body contains the request message as received by the server"
        }
      },
      {
        code: 206,
        phrase: "Partial Content",
        constant: "PARTIAL_CONTENT",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7233#section-4.1",
          description: "This response code is used because of range header sent by the client to separate download into multiple streams."
        }
      },
      {
        code: 402,
        phrase: "Payment Required",
        constant: "PAYMENT_REQUIRED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.2",
          description: "This response code is reserved for future use. Initial aim for creating this code was using it for digital payment systems however this is not used currently."
        }
      },
      {
        code: 308,
        phrase: "Permanent Redirect",
        constant: "PERMANENT_REDIRECT",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7538#section-3",
          description: "This means that the resource is now permanently located at another URI, specified by the Location: HTTP Response header. This has the same semantics as the 301 Moved Permanently HTTP response code, with the exception that the user agent must not change the HTTP method used: if a POST was used in the first request, a POST must be used in the second request."
        }
      },
      {
        code: 412,
        phrase: "Precondition Failed",
        constant: "PRECONDITION_FAILED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7232#section-4.2",
          description: "The client has indicated preconditions in its headers which the server does not meet."
        }
      },
      {
        code: 428,
        phrase: "Precondition Required",
        constant: "PRECONDITION_REQUIRED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc6585#section-3",
          description: "The origin server requires the request to be conditional. Intended to prevent the 'lost update' problem, where a client GETs a resource's state, modifies it, and PUTs it back to the server, when meanwhile a third party has modified the state on the server, leading to a conflict."
        }
      },
      {
        code: 102,
        phrase: "Processing",
        constant: "PROCESSING",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.1",
          description: "This code indicates that the server has received and is processing the request, but no response is available yet."
        }
      },
      {
        code: 407,
        phrase: "Proxy Authentication Required",
        constant: "PROXY_AUTHENTICATION_REQUIRED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7235#section-3.2",
          description: "This is similar to 401 but authentication is needed to be done by a proxy."
        }
      },
      {
        code: 431,
        phrase: "Request Header Fields Too Large",
        constant: "REQUEST_HEADER_FIELDS_TOO_LARGE",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc6585#section-5",
          description: "The server is unwilling to process the request because its header fields are too large. The request MAY be resubmitted after reducing the size of the request header fields."
        }
      },
      {
        code: 408,
        phrase: "Request Timeout",
        constant: "REQUEST_TIMEOUT",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.7",
          description: "This response is sent on an idle connection by some servers, even without any previous request by the client. It means that the server would like to shut down this unused connection. This response is used much more since some browsers, like Chrome, Firefox 27+, or IE9, use HTTP pre-connection mechanisms to speed up surfing. Also note that some servers merely shut down the connection without sending this message."
        }
      },
      {
        code: 413,
        phrase: "Request Entity Too Large",
        constant: "REQUEST_TOO_LONG",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.11",
          description: "Request entity is larger than limits defined by server; the server might close the connection or return an Retry-After header field."
        }
      },
      {
        code: 414,
        phrase: "Request-URI Too Long",
        constant: "REQUEST_URI_TOO_LONG",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.12",
          description: "The URI requested by the client is longer than the server is willing to interpret."
        }
      },
      {
        code: 416,
        phrase: "Requested Range Not Satisfiable",
        constant: "REQUESTED_RANGE_NOT_SATISFIABLE",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7233#section-4.4",
          description: "The range specified by the Range header field in the request can't be fulfilled; it's possible that the range is outside the size of the target URI's data."
        }
      },
      {
        code: 205,
        phrase: "Reset Content",
        constant: "RESET_CONTENT",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.6",
          description: "This response code is sent after accomplishing request to tell user agent reset document view which sent this request."
        }
      },
      {
        code: 303,
        phrase: "See Other",
        constant: "SEE_OTHER",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.4",
          description: "Server sent this response to directing client to get requested resource to another URI with an GET request."
        }
      },
      {
        code: 503,
        phrase: "Service Unavailable",
        constant: "SERVICE_UNAVAILABLE",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.4",
          description: "The server is not ready to handle the request. Common causes are a server that is down for maintenance or that is overloaded. Note that together with this response, a user-friendly page explaining the problem should be sent. This responses should be used for temporary conditions and the Retry-After: HTTP header should, if possible, contain the estimated time before the recovery of the service. The webmaster must also take care about the caching-related headers that are sent along with this response, as these temporary condition responses should usually not be cached."
        }
      },
      {
        code: 101,
        phrase: "Switching Protocols",
        constant: "SWITCHING_PROTOCOLS",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.2.2",
          description: "This code is sent in response to an Upgrade request header by the client, and indicates the protocol the server is switching too."
        }
      },
      {
        code: 307,
        phrase: "Temporary Redirect",
        constant: "TEMPORARY_REDIRECT",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.7",
          description: "Server sent this response to directing client to get requested resource to another URI with same method that used prior request. This has the same semantic than the 302 Found HTTP response code, with the exception that the user agent must not change the HTTP method used: if a POST was used in the first request, a POST must be used in the second request."
        }
      },
      {
        code: 429,
        phrase: "Too Many Requests",
        constant: "TOO_MANY_REQUESTS",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc6585#section-4",
          description: 'The user has sent too many requests in a given amount of time ("rate limiting").'
        }
      },
      {
        code: 401,
        phrase: "Unauthorized",
        constant: "UNAUTHORIZED",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7235#section-3.1",
          description: 'Although the HTTP standard specifies "unauthorized", semantically this response means "unauthenticated". That is, the client must authenticate itself to get the requested response.'
        }
      },
      {
        code: 451,
        phrase: "Unavailable For Legal Reasons",
        constant: "UNAVAILABLE_FOR_LEGAL_REASONS",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7725",
          description: "The user-agent requested a resource that cannot legally be provided, such as a web page censored by a government."
        }
      },
      {
        code: 422,
        phrase: "Unprocessable Entity",
        constant: "UNPROCESSABLE_ENTITY",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.3",
          description: "The request was well-formed but was unable to be followed due to semantic errors."
        }
      },
      {
        code: 415,
        phrase: "Unsupported Media Type",
        constant: "UNSUPPORTED_MEDIA_TYPE",
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.13",
          description: "The media format of the requested data is not supported by the server, so the server is rejecting the request."
        }
      },
      {
        code: 305,
        phrase: "Use Proxy",
        constant: "USE_PROXY",
        isDeprecated: true,
        comment: {
          doc: "Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.4.6",
          description: "Was defined in a previous version of the HTTP specification to indicate that a requested response must be accessed by a proxy. It has been deprecated due to security concerns regarding in-band configuration of a proxy."
        }
      }
    ];
  });

  // src/lib/response.js
  var require_response = __commonJS((exports, module) => {
    const maxPipelines = 256;
    function Response(socket) {
      this.socket = socket;
      return this;
    }
    Response.prototype.send = function(content, status = 200) {
      let r = `HTTP/1.1 ${status} ${getHttpPhrase(status)}\r
Content-Length: ${content.length}\r
\r
${content}`;
      let buf = ArrayBuffer.fromString(r.repeat(maxPipelines));
      if (this.socket.write(buf, r.length) <= 0)
        return;
      this.socket.close();
    };
    Response.prototype.json = function(object, status = 200) {
      let jm = JSON.stringify(object);
      this.send(jm);
    };
    Response.prototype.end = function(status = 200) {
      this.send("", status);
      this.socket.close();
    };
    function createResponse2(socket) {
      return new Response(socket);
    }
    module.exports = {createResponse: createResponse2};
  });

  // src/lib/router/lib/router.js
  var require_router = __commonJS((exports, module) => {
    function Router2(options) {
      if (!(this instanceof Router2))
        return new Router2(options);
      this._init(options);
    }
    Router2.prototype._init = function(options) {
      options = options || {};
      this.child = Object.create(null);
      this.children = [];
      this.name = options.name || "";
      if (typeof options.string === "string")
        this.string = options.string;
      else if (typeof options.regex === "string")
        this.regex = new RegExp("^(" + options.regex + ")$", options.flag == null ? "i" : options.flag);
      else if (options.regex instanceof RegExp)
        this.regex = options.regex;
    };
    Router2.prototype._add = function(options) {
      return this._find(options) || this._attach(options);
    };
    Router2.prototype._find = function(options) {
      if (typeof options.string === "string")
        return this.child[options.string];
      var child;
      var children = this.children;
      var l = children.length;
      if (options.name) {
        for (var j = 0; j < l; j++)
          if ((child = children[j]).name === options.name)
            return child;
      }
    };
    Router2.prototype._attach = function(node) {
      if (!(node instanceof Router2))
        node = new Router2(node);
      node.parent = this;
      if (node.string == null)
        this.children.push(node);
      else
        this.child[node.string] = node;
      return node;
    };
    module.exports = Router2;
  });

  // node_modules/flatten/index.js
  var require_flatten = __commonJS((exports, module) => {
    module.exports = function flatten(list, depth) {
      depth = typeof depth == "number" ? depth : Infinity;
      if (!depth) {
        if (Array.isArray(list)) {
          return list.map(function(i) {
            return i;
          });
        }
        return list;
      }
      return _flatten(list, 1);
      function _flatten(list2, d) {
        return list2.reduce(function(acc, item) {
          if (Array.isArray(item) && d < depth) {
            return acc.concat(_flatten(item, d + 1));
          } else {
            return acc.concat(item);
          }
        }, []);
      }
    };
  });

  // src/lib/router/lib/define.js
  var require_define = __commonJS(() => {
    var flatten = require_flatten();
    var Router2 = require_router();
    Router2.prototype.define = function(route) {
      if (typeof route !== "string")
        throw new TypeError("Only strings can be defined.");
      try {
        return Define(route.split("/"), this);
      } catch (err) {
        err.route = route;
        throw err;
      }
    };
    function Define(frags, root) {
      var frag = frags[0];
      var info = Router2.parse(frag);
      var name = info.name;
      var nodes = Object.keys(info.string).map(function(x) {
        return {
          name,
          string: x
        };
      });
      if (info.regex) {
        nodes.push({
          name,
          regex: info.regex
        });
      }
      if (!nodes.length) {
        nodes = [{
          name
        }];
      }
      nodes = nodes.map(root._add, root);
      return frags.length - 1 ? flatten(nodes.map(Define.bind(null, frags.slice(1)))) : nodes;
    }
  });

  // src/lib/router/lib/match.js
  var require_match = __commonJS(() => {
    var Router2 = require_router();
    Router2.prototype.match = function(url3) {
      var root = this;
      var frags = url3.split("/");
      var length = frags.length;
      var match = {
        param: {}
      };
      var frag, node, nodes, regex, name;
      top:
        while (length) {
          frag = decode(frags.shift());
          if (frag === -1) {
            throw "Malformed URL: " + url3;
          }
          length = frags.length;
          if (node = root.child[frag]) {
            if (name = node.name)
              match.param[name] = frag;
            if (!length) {
              match.node = node;
              return match;
            }
            root = node;
            continue top;
          }
          nodes = root.children;
          for (var i = 0, l = nodes.length; i < l; i++) {
            node = nodes[i];
            if (!(regex = node.regex) || regex.test(frag)) {
              if (name = node.name)
                match.param[name] = frag;
              if (!length) {
                match.node = node;
                return match;
              }
              root = node;
              continue top;
            }
          }
          return;
        }
    };
    function decode(string) {
      try {
        return decodeURIComponent(string);
      } catch (err) {
        return -1;
      }
    }
  });

  // src/lib/router/lib/parse.js
  var require_parse = __commonJS(() => {
    var Router2 = require_router();
    Router2.parse = function(string) {
      var options = Parse(string);
      if (!options) {
        throw "Invalid parsed string: " + string;
      }
      return options;
    };
    function Parse(string) {
      var options = {
        name: "",
        string: {},
        regex: ""
      };
      if (isValidSlug(string)) {
        options.string[string] = true;
        return options;
      }
      if (isPipeSeparatedString(string)) {
        string.split("|").forEach(function(x) {
          options.string[x] = true;
        });
        return options;
      }
      string = string.replace(/^\:\w+\b/, function(_) {
        options.name = _.slice(1);
        return "";
      });
      if (!string)
        return options;
      if (/^\(.+\)$/.test(string) && (string = string.slice(1, -1))) {
        if (isPipeSeparatedString(string))
          string.split("|").filter(function(x) {
            options.string[x] = true;
          });
        else
          options.regex = string;
        return options;
      }
    }
    function isValidSlug(x) {
      return x === "" || /^[\w\.-]+$/.test(x);
    }
    function isPipeSeparatedString(x) {
      return /^[\w\.\-][\w\.\-\|]+[\w\.\-]$/.test(x);
    }
  });

  // node_modules/punycode/punycode.js
  var require_punycode = __commonJS((exports, module) => {
    /*! https://mths.be/punycode v1.3.2 by @mathias */
    (function(root) {
      var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
      var freeModule = typeof module == "object" && module && !module.nodeType && module;
      var freeGlobal = typeof global == "object" && global;
      if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal || freeGlobal.self === freeGlobal) {
        root = freeGlobal;
      }
      var punycode, maxInt = 2147483647, base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700, initialBias = 72, initialN = 128, delimiter = "-", regexPunycode = /^xn--/, regexNonASCII = /[^\x20-\x7E]/, regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, errors = {
        overflow: "Overflow: input needs wider integers to process",
        "not-basic": "Illegal input >= 0x80 (not a basic code point)",
        "invalid-input": "Invalid input"
      }, baseMinusTMin = base - tMin, floor = Math.floor, stringFromCharCode = String.fromCharCode, key;
      function error(type) {
        throw RangeError(errors[type]);
      }
      function map(array, fn) {
        var length = array.length;
        var result = [];
        while (length--) {
          result[length] = fn(array[length]);
        }
        return result;
      }
      function mapDomain(string, fn) {
        var parts = string.split("@");
        var result = "";
        if (parts.length > 1) {
          result = parts[0] + "@";
          string = parts[1];
        }
        string = string.replace(regexSeparators, ".");
        var labels = string.split(".");
        var encoded = map(labels, fn).join(".");
        return result + encoded;
      }
      function ucs2decode(string) {
        var output = [], counter = 0, length = string.length, value, extra;
        while (counter < length) {
          value = string.charCodeAt(counter++);
          if (value >= 55296 && value <= 56319 && counter < length) {
            extra = string.charCodeAt(counter++);
            if ((extra & 64512) == 56320) {
              output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
            } else {
              output.push(value);
              counter--;
            }
          } else {
            output.push(value);
          }
        }
        return output;
      }
      function ucs2encode(array) {
        return map(array, function(value) {
          var output = "";
          if (value > 65535) {
            value -= 65536;
            output += stringFromCharCode(value >>> 10 & 1023 | 55296);
            value = 56320 | value & 1023;
          }
          output += stringFromCharCode(value);
          return output;
        }).join("");
      }
      function basicToDigit(codePoint) {
        if (codePoint - 48 < 10) {
          return codePoint - 22;
        }
        if (codePoint - 65 < 26) {
          return codePoint - 65;
        }
        if (codePoint - 97 < 26) {
          return codePoint - 97;
        }
        return base;
      }
      function digitToBasic(digit, flag) {
        return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
      }
      function adapt(delta, numPoints, firstTime) {
        var k = 0;
        delta = firstTime ? floor(delta / damp) : delta >> 1;
        delta += floor(delta / numPoints);
        for (; delta > baseMinusTMin * tMax >> 1; k += base) {
          delta = floor(delta / baseMinusTMin);
        }
        return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
      }
      function decode(input) {
        var output = [], inputLength = input.length, out, i = 0, n = initialN, bias = initialBias, basic, j, index, oldi, w, k, digit, t, baseMinusT;
        basic = input.lastIndexOf(delimiter);
        if (basic < 0) {
          basic = 0;
        }
        for (j = 0; j < basic; ++j) {
          if (input.charCodeAt(j) >= 128) {
            error("not-basic");
          }
          output.push(input.charCodeAt(j));
        }
        for (index = basic > 0 ? basic + 1 : 0; index < inputLength; ) {
          for (oldi = i, w = 1, k = base; ; k += base) {
            if (index >= inputLength) {
              error("invalid-input");
            }
            digit = basicToDigit(input.charCodeAt(index++));
            if (digit >= base || digit > floor((maxInt - i) / w)) {
              error("overflow");
            }
            i += digit * w;
            t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
            if (digit < t) {
              break;
            }
            baseMinusT = base - t;
            if (w > floor(maxInt / baseMinusT)) {
              error("overflow");
            }
            w *= baseMinusT;
          }
          out = output.length + 1;
          bias = adapt(i - oldi, out, oldi == 0);
          if (floor(i / out) > maxInt - n) {
            error("overflow");
          }
          n += floor(i / out);
          i %= out;
          output.splice(i++, 0, n);
        }
        return ucs2encode(output);
      }
      function encode(input) {
        var n, delta, handledCPCount, basicLength, bias, j, m, q, k, t, currentValue, output = [], inputLength, handledCPCountPlusOne, baseMinusT, qMinusT;
        input = ucs2decode(input);
        inputLength = input.length;
        n = initialN;
        delta = 0;
        bias = initialBias;
        for (j = 0; j < inputLength; ++j) {
          currentValue = input[j];
          if (currentValue < 128) {
            output.push(stringFromCharCode(currentValue));
          }
        }
        handledCPCount = basicLength = output.length;
        if (basicLength) {
          output.push(delimiter);
        }
        while (handledCPCount < inputLength) {
          for (m = maxInt, j = 0; j < inputLength; ++j) {
            currentValue = input[j];
            if (currentValue >= n && currentValue < m) {
              m = currentValue;
            }
          }
          handledCPCountPlusOne = handledCPCount + 1;
          if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
            error("overflow");
          }
          delta += (m - n) * handledCPCountPlusOne;
          n = m;
          for (j = 0; j < inputLength; ++j) {
            currentValue = input[j];
            if (currentValue < n && ++delta > maxInt) {
              error("overflow");
            }
            if (currentValue == n) {
              for (q = delta, k = base; ; k += base) {
                t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                if (q < t) {
                  break;
                }
                qMinusT = q - t;
                baseMinusT = base - t;
                output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
                q = floor(qMinusT / baseMinusT);
              }
              output.push(stringFromCharCode(digitToBasic(q, 0)));
              bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
              delta = 0;
              ++handledCPCount;
            }
          }
          ++delta;
          ++n;
        }
        return output.join("");
      }
      function toUnicode(input) {
        return mapDomain(input, function(string) {
          return regexPunycode.test(string) ? decode(string.slice(4).toLowerCase()) : string;
        });
      }
      function toASCII(input) {
        return mapDomain(input, function(string) {
          return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
        });
      }
      punycode = {
        version: "1.3.2",
        ucs2: {
          decode: ucs2decode,
          encode: ucs2encode
        },
        decode,
        encode,
        toASCII,
        toUnicode
      };
      if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
        define("punycode", function() {
          return punycode;
        });
      } else if (freeExports && freeModule) {
        if (module.exports == freeExports) {
          freeModule.exports = punycode;
        } else {
          for (key in punycode) {
            punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
          }
        }
      } else {
        root.punycode = punycode;
      }
    })(exports);
  });

  // node_modules/url/util.js
  var require_util = __commonJS((exports, module) => {
    "use strict";
    module.exports = {
      isString: function(arg) {
        return typeof arg === "string";
      },
      isObject: function(arg) {
        return typeof arg === "object" && arg !== null;
      },
      isNull: function(arg) {
        return arg === null;
      },
      isNullOrUndefined: function(arg) {
        return arg == null;
      }
    };
  });

  // node_modules/querystring/decode.js
  var require_decode = __commonJS((exports, module) => {
    "use strict";
    function hasOwnProperty(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    }
    module.exports = function(qs, sep, eq, options) {
      sep = sep || "&";
      eq = eq || "=";
      var obj = {};
      if (typeof qs !== "string" || qs.length === 0) {
        return obj;
      }
      var regexp = /\+/g;
      qs = qs.split(sep);
      var maxKeys = 1e3;
      if (options && typeof options.maxKeys === "number") {
        maxKeys = options.maxKeys;
      }
      var len = qs.length;
      if (maxKeys > 0 && len > maxKeys) {
        len = maxKeys;
      }
      for (var i = 0; i < len; ++i) {
        var x = qs[i].replace(regexp, "%20"), idx = x.indexOf(eq), kstr, vstr, k, v;
        if (idx >= 0) {
          kstr = x.substr(0, idx);
          vstr = x.substr(idx + 1);
        } else {
          kstr = x;
          vstr = "";
        }
        k = decodeURIComponent(kstr);
        v = decodeURIComponent(vstr);
        if (!hasOwnProperty(obj, k)) {
          obj[k] = v;
        } else if (Array.isArray(obj[k])) {
          obj[k].push(v);
        } else {
          obj[k] = [obj[k], v];
        }
      }
      return obj;
    };
  });

  // node_modules/querystring/encode.js
  var require_encode = __commonJS((exports, module) => {
    "use strict";
    var stringifyPrimitive = function(v) {
      switch (typeof v) {
        case "string":
          return v;
        case "boolean":
          return v ? "true" : "false";
        case "number":
          return isFinite(v) ? v : "";
        default:
          return "";
      }
    };
    module.exports = function(obj, sep, eq, name) {
      sep = sep || "&";
      eq = eq || "=";
      if (obj === null) {
        obj = void 0;
      }
      if (typeof obj === "object") {
        return Object.keys(obj).map(function(k) {
          var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
          if (Array.isArray(obj[k])) {
            return obj[k].map(function(v) {
              return ks + encodeURIComponent(stringifyPrimitive(v));
            }).join(sep);
          } else {
            return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
          }
        }).join(sep);
      }
      if (!name)
        return "";
      return encodeURIComponent(stringifyPrimitive(name)) + eq + encodeURIComponent(stringifyPrimitive(obj));
    };
  });

  // node_modules/querystring/index.js
  var require_querystring = __commonJS((exports) => {
    "use strict";
    exports.decode = exports.parse = require_decode();
    exports.encode = exports.stringify = require_encode();
  });

  // node_modules/url/url.js
  var require_url = __commonJS((exports) => {
    "use strict";
    var punycode = require_punycode();
    var util = require_util();
    exports.parse = urlParse;
    exports.resolve = urlResolve;
    exports.resolveObject = urlResolveObject;
    exports.format = urlFormat;
    exports.Url = Url;
    function Url() {
      this.protocol = null;
      this.slashes = null;
      this.auth = null;
      this.host = null;
      this.port = null;
      this.hostname = null;
      this.hash = null;
      this.search = null;
      this.query = null;
      this.pathname = null;
      this.path = null;
      this.href = null;
    }
    var protocolPattern = /^([a-z0-9.+-]+:)/i;
    var portPattern = /:[0-9]*$/;
    var simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
    var delims = ["<", ">", '"', "`", " ", "\r", "\n", "	"];
    var unwise = ["{", "}", "|", "\\", "^", "`"].concat(delims);
    var autoEscape = ["'"].concat(unwise);
    var nonHostChars = ["%", "/", "?", ";", "#"].concat(autoEscape);
    var hostEndingChars = ["/", "?", "#"];
    var hostnameMaxLen = 255;
    var hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
    var hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
    var unsafeProtocol = {
      javascript: true,
      "javascript:": true
    };
    var hostlessProtocol = {
      javascript: true,
      "javascript:": true
    };
    var slashedProtocol = {
      http: true,
      https: true,
      ftp: true,
      gopher: true,
      file: true,
      "http:": true,
      "https:": true,
      "ftp:": true,
      "gopher:": true,
      "file:": true
    };
    var querystring = require_querystring();
    function urlParse(url3, parseQueryString, slashesDenoteHost) {
      if (url3 && util.isObject(url3) && url3 instanceof Url)
        return url3;
      var u = new Url();
      u.parse(url3, parseQueryString, slashesDenoteHost);
      return u;
    }
    Url.prototype.parse = function(url3, parseQueryString, slashesDenoteHost) {
      if (!util.isString(url3)) {
        throw new TypeError("Parameter 'url' must be a string, not " + typeof url3);
      }
      var queryIndex = url3.indexOf("?"), splitter = queryIndex !== -1 && queryIndex < url3.indexOf("#") ? "?" : "#", uSplit = url3.split(splitter), slashRegex = /\\/g;
      uSplit[0] = uSplit[0].replace(slashRegex, "/");
      url3 = uSplit.join(splitter);
      var rest = url3;
      rest = rest.trim();
      if (!slashesDenoteHost && url3.split("#").length === 1) {
        var simplePath = simplePathPattern.exec(rest);
        if (simplePath) {
          this.path = rest;
          this.href = rest;
          this.pathname = simplePath[1];
          if (simplePath[2]) {
            this.search = simplePath[2];
            if (parseQueryString) {
              this.query = querystring.parse(this.search.substr(1));
            } else {
              this.query = this.search.substr(1);
            }
          } else if (parseQueryString) {
            this.search = "";
            this.query = {};
          }
          return this;
        }
      }
      var proto = protocolPattern.exec(rest);
      if (proto) {
        proto = proto[0];
        var lowerProto = proto.toLowerCase();
        this.protocol = lowerProto;
        rest = rest.substr(proto.length);
      }
      if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
        var slashes = rest.substr(0, 2) === "//";
        if (slashes && !(proto && hostlessProtocol[proto])) {
          rest = rest.substr(2);
          this.slashes = true;
        }
      }
      if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
        var hostEnd = -1;
        for (var i = 0; i < hostEndingChars.length; i++) {
          var hec = rest.indexOf(hostEndingChars[i]);
          if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
            hostEnd = hec;
        }
        var auth, atSign;
        if (hostEnd === -1) {
          atSign = rest.lastIndexOf("@");
        } else {
          atSign = rest.lastIndexOf("@", hostEnd);
        }
        if (atSign !== -1) {
          auth = rest.slice(0, atSign);
          rest = rest.slice(atSign + 1);
          this.auth = decodeURIComponent(auth);
        }
        hostEnd = -1;
        for (var i = 0; i < nonHostChars.length; i++) {
          var hec = rest.indexOf(nonHostChars[i]);
          if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
            hostEnd = hec;
        }
        if (hostEnd === -1)
          hostEnd = rest.length;
        this.host = rest.slice(0, hostEnd);
        rest = rest.slice(hostEnd);
        this.parseHost();
        this.hostname = this.hostname || "";
        var ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
        if (!ipv6Hostname) {
          var hostparts = this.hostname.split(/\./);
          for (var i = 0, l = hostparts.length; i < l; i++) {
            var part = hostparts[i];
            if (!part)
              continue;
            if (!part.match(hostnamePartPattern)) {
              var newpart = "";
              for (var j = 0, k = part.length; j < k; j++) {
                if (part.charCodeAt(j) > 127) {
                  newpart += "x";
                } else {
                  newpart += part[j];
                }
              }
              if (!newpart.match(hostnamePartPattern)) {
                var validParts = hostparts.slice(0, i);
                var notHost = hostparts.slice(i + 1);
                var bit = part.match(hostnamePartStart);
                if (bit) {
                  validParts.push(bit[1]);
                  notHost.unshift(bit[2]);
                }
                if (notHost.length) {
                  rest = "/" + notHost.join(".") + rest;
                }
                this.hostname = validParts.join(".");
                break;
              }
            }
          }
        }
        if (this.hostname.length > hostnameMaxLen) {
          this.hostname = "";
        } else {
          this.hostname = this.hostname.toLowerCase();
        }
        if (!ipv6Hostname) {
          this.hostname = punycode.toASCII(this.hostname);
        }
        var p = this.port ? ":" + this.port : "";
        var h = this.hostname || "";
        this.host = h + p;
        this.href += this.host;
        if (ipv6Hostname) {
          this.hostname = this.hostname.substr(1, this.hostname.length - 2);
          if (rest[0] !== "/") {
            rest = "/" + rest;
          }
        }
      }
      if (!unsafeProtocol[lowerProto]) {
        for (var i = 0, l = autoEscape.length; i < l; i++) {
          var ae = autoEscape[i];
          if (rest.indexOf(ae) === -1)
            continue;
          var esc = encodeURIComponent(ae);
          if (esc === ae) {
            esc = escape(ae);
          }
          rest = rest.split(ae).join(esc);
        }
      }
      var hash = rest.indexOf("#");
      if (hash !== -1) {
        this.hash = rest.substr(hash);
        rest = rest.slice(0, hash);
      }
      var qm = rest.indexOf("?");
      if (qm !== -1) {
        this.search = rest.substr(qm);
        this.query = rest.substr(qm + 1);
        if (parseQueryString) {
          this.query = querystring.parse(this.query);
        }
        rest = rest.slice(0, qm);
      } else if (parseQueryString) {
        this.search = "";
        this.query = {};
      }
      if (rest)
        this.pathname = rest;
      if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
        this.pathname = "/";
      }
      if (this.pathname || this.search) {
        var p = this.pathname || "";
        var s = this.search || "";
        this.path = p + s;
      }
      this.href = this.format();
      return this;
    };
    function urlFormat(obj) {
      if (util.isString(obj))
        obj = urlParse(obj);
      if (!(obj instanceof Url))
        return Url.prototype.format.call(obj);
      return obj.format();
    }
    Url.prototype.format = function() {
      var auth = this.auth || "";
      if (auth) {
        auth = encodeURIComponent(auth);
        auth = auth.replace(/%3A/i, ":");
        auth += "@";
      }
      var protocol = this.protocol || "", pathname = this.pathname || "", hash = this.hash || "", host = false, query = "";
      if (this.host) {
        host = auth + this.host;
      } else if (this.hostname) {
        host = auth + (this.hostname.indexOf(":") === -1 ? this.hostname : "[" + this.hostname + "]");
        if (this.port) {
          host += ":" + this.port;
        }
      }
      if (this.query && util.isObject(this.query) && Object.keys(this.query).length) {
        query = querystring.stringify(this.query);
      }
      var search = this.search || query && "?" + query || "";
      if (protocol && protocol.substr(-1) !== ":")
        protocol += ":";
      if (this.slashes || (!protocol || slashedProtocol[protocol]) && host !== false) {
        host = "//" + (host || "");
        if (pathname && pathname.charAt(0) !== "/")
          pathname = "/" + pathname;
      } else if (!host) {
        host = "";
      }
      if (hash && hash.charAt(0) !== "#")
        hash = "#" + hash;
      if (search && search.charAt(0) !== "?")
        search = "?" + search;
      pathname = pathname.replace(/[?#]/g, function(match) {
        return encodeURIComponent(match);
      });
      search = search.replace("#", "%23");
      return protocol + host + pathname + search + hash;
    };
    function urlResolve(source, relative) {
      return urlParse(source, false, true).resolve(relative);
    }
    Url.prototype.resolve = function(relative) {
      return this.resolveObject(urlParse(relative, false, true)).format();
    };
    function urlResolveObject(source, relative) {
      if (!source)
        return relative;
      return urlParse(source, false, true).resolveObject(relative);
    }
    Url.prototype.resolveObject = function(relative) {
      if (util.isString(relative)) {
        var rel = new Url();
        rel.parse(relative, false, true);
        relative = rel;
      }
      var result = new Url();
      var tkeys = Object.keys(this);
      for (var tk = 0; tk < tkeys.length; tk++) {
        var tkey = tkeys[tk];
        result[tkey] = this[tkey];
      }
      result.hash = relative.hash;
      if (relative.href === "") {
        result.href = result.format();
        return result;
      }
      if (relative.slashes && !relative.protocol) {
        var rkeys = Object.keys(relative);
        for (var rk = 0; rk < rkeys.length; rk++) {
          var rkey = rkeys[rk];
          if (rkey !== "protocol")
            result[rkey] = relative[rkey];
        }
        if (slashedProtocol[result.protocol] && result.hostname && !result.pathname) {
          result.path = result.pathname = "/";
        }
        result.href = result.format();
        return result;
      }
      if (relative.protocol && relative.protocol !== result.protocol) {
        if (!slashedProtocol[relative.protocol]) {
          var keys = Object.keys(relative);
          for (var v = 0; v < keys.length; v++) {
            var k = keys[v];
            result[k] = relative[k];
          }
          result.href = result.format();
          return result;
        }
        result.protocol = relative.protocol;
        if (!relative.host && !hostlessProtocol[relative.protocol]) {
          var relPath = (relative.pathname || "").split("/");
          while (relPath.length && !(relative.host = relPath.shift()))
            ;
          if (!relative.host)
            relative.host = "";
          if (!relative.hostname)
            relative.hostname = "";
          if (relPath[0] !== "")
            relPath.unshift("");
          if (relPath.length < 2)
            relPath.unshift("");
          result.pathname = relPath.join("/");
        } else {
          result.pathname = relative.pathname;
        }
        result.search = relative.search;
        result.query = relative.query;
        result.host = relative.host || "";
        result.auth = relative.auth;
        result.hostname = relative.hostname || relative.host;
        result.port = relative.port;
        if (result.pathname || result.search) {
          var p = result.pathname || "";
          var s = result.search || "";
          result.path = p + s;
        }
        result.slashes = result.slashes || relative.slashes;
        result.href = result.format();
        return result;
      }
      var isSourceAbs = result.pathname && result.pathname.charAt(0) === "/", isRelAbs = relative.host || relative.pathname && relative.pathname.charAt(0) === "/", mustEndAbs = isRelAbs || isSourceAbs || result.host && relative.pathname, removeAllDots = mustEndAbs, srcPath = result.pathname && result.pathname.split("/") || [], relPath = relative.pathname && relative.pathname.split("/") || [], psychotic = result.protocol && !slashedProtocol[result.protocol];
      if (psychotic) {
        result.hostname = "";
        result.port = null;
        if (result.host) {
          if (srcPath[0] === "")
            srcPath[0] = result.host;
          else
            srcPath.unshift(result.host);
        }
        result.host = "";
        if (relative.protocol) {
          relative.hostname = null;
          relative.port = null;
          if (relative.host) {
            if (relPath[0] === "")
              relPath[0] = relative.host;
            else
              relPath.unshift(relative.host);
          }
          relative.host = null;
        }
        mustEndAbs = mustEndAbs && (relPath[0] === "" || srcPath[0] === "");
      }
      if (isRelAbs) {
        result.host = relative.host || relative.host === "" ? relative.host : result.host;
        result.hostname = relative.hostname || relative.hostname === "" ? relative.hostname : result.hostname;
        result.search = relative.search;
        result.query = relative.query;
        srcPath = relPath;
      } else if (relPath.length) {
        if (!srcPath)
          srcPath = [];
        srcPath.pop();
        srcPath = srcPath.concat(relPath);
        result.search = relative.search;
        result.query = relative.query;
      } else if (!util.isNullOrUndefined(relative.search)) {
        if (psychotic) {
          result.hostname = result.host = srcPath.shift();
          var authInHost = result.host && result.host.indexOf("@") > 0 ? result.host.split("@") : false;
          if (authInHost) {
            result.auth = authInHost.shift();
            result.host = result.hostname = authInHost.shift();
          }
        }
        result.search = relative.search;
        result.query = relative.query;
        if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
          result.path = (result.pathname ? result.pathname : "") + (result.search ? result.search : "");
        }
        result.href = result.format();
        return result;
      }
      if (!srcPath.length) {
        result.pathname = null;
        if (result.search) {
          result.path = "/" + result.search;
        } else {
          result.path = null;
        }
        result.href = result.format();
        return result;
      }
      var last = srcPath.slice(-1)[0];
      var hasTrailingSlash = (result.host || relative.host || srcPath.length > 1) && (last === "." || last === "..") || last === "";
      var up = 0;
      for (var i = srcPath.length; i >= 0; i--) {
        last = srcPath[i];
        if (last === ".") {
          srcPath.splice(i, 1);
        } else if (last === "..") {
          srcPath.splice(i, 1);
          up++;
        } else if (up) {
          srcPath.splice(i, 1);
          up--;
        }
      }
      if (!mustEndAbs && !removeAllDots) {
        for (; up--; up) {
          srcPath.unshift("..");
        }
      }
      if (mustEndAbs && srcPath[0] !== "" && (!srcPath[0] || srcPath[0].charAt(0) !== "/")) {
        srcPath.unshift("");
      }
      if (hasTrailingSlash && srcPath.join("/").substr(-1) !== "/") {
        srcPath.push("");
      }
      var isAbsolute = srcPath[0] === "" || srcPath[0] && srcPath[0].charAt(0) === "/";
      if (psychotic) {
        result.hostname = result.host = isAbsolute ? "" : srcPath.length ? srcPath.shift() : "";
        var authInHost = result.host && result.host.indexOf("@") > 0 ? result.host.split("@") : false;
        if (authInHost) {
          result.auth = authInHost.shift();
          result.host = result.hostname = authInHost.shift();
        }
      }
      mustEndAbs = mustEndAbs || result.host && srcPath.length;
      if (mustEndAbs && !isAbsolute) {
        srcPath.unshift("");
      }
      if (!srcPath.length) {
        result.pathname = null;
        result.path = null;
      } else {
        result.pathname = srcPath.join("/");
      }
      if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
        result.path = (result.pathname ? result.pathname : "") + (result.search ? result.search : "");
      }
      result.auth = relative.auth || result.auth;
      result.slashes = result.slashes || relative.slashes;
      result.href = result.format();
      return result;
    };
    Url.prototype.parseHost = function() {
      var host = this.host;
      var port = portPattern.exec(host);
      if (port) {
        port = port[0];
        if (port !== ":") {
          this.port = port.substr(1);
        }
        host = host.substr(0, host.length - port.length);
      }
      if (host)
        this.hostname = host;
    };
  });

  // src/lib/application.js
  const {print: print2} = just;
  const {createHTTPStream} = require_http();
  const {createServer} = require_net();

  // src/lib/utils/httpcodes.js
  const {print} = just;
  const codes = require_http_codes();
  function getHttpPhrase(status) {
    return _codeDict[status].phrase;
  }
  const _codeDict = {};
  function _loadCodes() {
    for (const c of codes) {
      if (c) {
        _codeDict[c.code] = c;
      }
    }
  }
  _loadCodes();

  // src/lib/application.js
  const {createResponse} = require_response();
  const maxPipeline = 256;
  const stats = {rps: 0, wps: 0, conn: 0};
  let qps = 0;
  class Application {
    middleware = [];
    use = (middleware2) => {
      this.middleware.push(middleware2);
      return this;
    };
    start = () => {
      print2("Starting server...");
      createServer(this._onConnect.bind(this)).listen();
      return this;
    };
    stop = () => {
    };
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
    };
    _handleRequest = (method, url3, socket) => {
      const req = {method, url: url3}, res = createResponse(socket);
      let handled = this._passRequest(0, req, res);
      if (!handled) {
        print2("Request not handled: " + url3);
        res.end(404);
      }
    };
    _getRequestHeaderParts(stream) {
      let headers = stream.getHeaders().split("\n");
      let pathParts = headers[0].split(" ");
      return {
        method: pathParts.length ? pathParts[0] : void 0,
        url: pathParts.length > 1 ? pathParts[1] : void 0
      };
    }
    _onConnect = (socket) => {
      const self = this;
      stats.conn++;
      const stream = createHTTPStream(socket.buf, maxPipeline);
      socket.onReadable = () => {
        const bytes = socket.pull(stream.offset);
        if (bytes <= 0)
          return;
        const err = stream.parse(bytes, (count) => {
          qps += count;
          stats.rps += bytes;
          const {method, url: url3} = self._getRequestHeaderParts(stream);
          if (method && url3) {
            self._handleRequest(method, url3, socket);
          } else {
            print2("malformed request");
            socket.close();
          }
        });
        if (err < 0)
          print2(`error: ${err}`);
      };
      socket.onWritable = () => {
      };
      socket.onEnd = () => stats.conn--;
      return this;
    };
  }

  // src/lib/router/lib/index.js
  let _Router = require_router();
  require_define();
  require_match();
  require_parse();
  var lib_default = _Router;

  // src/lib/middleware.js
  class Middleware {
    handleRequest(req, res, next) {
      next();
    }
  }

  // src/lib/router/index.js
  const url = __toModule(require_url());
  const {print: print3} = just;
  const router = new lib_default();
  class Router extends Middleware {
    static get(path, handler) {
      var node = router.define(path)[0];
      node.GET = node.GET || [];
      node.GET.push(handler);
    }
    static post(path, handler) {
      var node = router.define(path)[0];
      node.POST = node.POST || [];
      node.POST.push(handler);
    }
    static put(path, handler) {
      var node = router.define(path)[0];
      node.PUT = node.PUT || [];
      node.PUT.push(handler);
    }
    static patch(path, handler) {
      var node = router.define(path)[0];
      node.PATCH = node.PATCH || [];
      node.PATCH.push(handler);
    }
    static delete(path, handler) {
      var node = router.define(path)[0];
      node.DELETE = node.DELETE || [];
      node.DELETE.push(handler);
    }
    static handleRequest(req, res, next) {
      var match = router.match(url.default.parse(req.url).pathname);
      if (!match) {
        print3("404: " + req.url);
        return next();
      }
      var node = match.node;
      var callbacks = node[req.method];
      if (!callbacks) {
        print3("405...");
        return;
      }
      callbacks.forEach((c) => {
        c(req, res);
      });
      next();
    }
  }

  // src/server.js
  let app = new Application();
  Router.get("/test", function(req, res) {
    let data = {
      something: "test"
    };
    res.json(data);
  });
  Router.get("/", function(req, res) {
    res.send("Home!");
  });
  app.use(Router);
  app.start();
})();
