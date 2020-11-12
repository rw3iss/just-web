
# What This Is:
    
    Example for the [JustJS](https://github.com/just-js/just[https://github.com/just-js/just) V8 JavaScript application technology (basically a much faster NodeJS alternative).
    
# Note
    
    This library is very primitive and not intended for usage yet, but basically works.
    
# How to use:

    copy this repository into a folder within the above JustJS repository's /examples folder.

    Navigate to the folder and 'npm start' to start the existing server.

    Edit the src/server.js code (and whatever src/lib code) to suit your application's needs (see below for development).

     
# To develop locally:

JustJS must be used with linux (or Docker), see repo above. To use this with the JustJS Docker build, add this to the JustJS .devcontainer/Dockerfile, in the middle somewhere, and rebuild the container:

    ## NODE + ESBUILD REQUIREMENTS ###
    RUN apt-get install -y curl nodejs
    RUN curl -sL https://deb.nodesource.com/setup_15.x | sudo -E bash -
    RUN sudo npm install nodemon esbuild -g
    ##################

Then start the nodemon development watcher and esbuilder with:

    npm run dev

# Building a web application with this library:  

See src/server.js for an example of how to initiailize a simple application with routes and responses.


# Features / Notes about this library:

* You can implement basic middleware, see src/lib/middleware.js for the api, basically just pass an object that implements handleResponse(res, res), and then pass that to yourApp.use(yourMiddleware).
* It's built with efficiency in mind, using only what's necessary (Application -> Router -> Response), all with only necessary implementation helpers.
* The built-in router uses a trie, the fastest implementation.
* All the configuration and data access is indexed and loaded at app startup, for fastest lookup and response from those method calls.

# API 😬

    Application {
        use(Middleware);    //register middleware to handle requests
        start();            // creates server and listens for requests
        stop();
    }

    Middleware {
        handleRequest(Request, Response, next);
    }

    Request {
        method: string;
        url:    string
    }

    Response {
        send(string, status = 200); // writes and ends connection
        json(object, status = 200); // stringifies json and sends
        end(status = 200);          // just closes the connection
    }

    Router {
        get(url, handler);  // handler = (req, res) => {}
        put(url, handler);
        post(url, handler);
        patch(url, handler);
        delete(url, handler);
    }


# TODO:
* Populate Request object with headers
* Add simple application config file support
* Implement Cookie handling
* Add extended modules (CORS?)