import Application from './lib/application';
import Router from './lib/router';
const { readFileBytes } = require('fs'); // built-in
const { log } = require('./lib/utils/log');

const favicon = readFileBytes('./static/favicon.ico');

let app = new Application();

// ROUTE REGISTRATION 
Router.get('/test', function(req, res) {
    let data = {
        something: "test"
    };
    res.json(data);
});

Router.get('/', function(req, res) {
    res.html('<h2>Home!</h2>');
});

Router.get('/favicon.ico', function(req, res) {
    return favicon != -1 ? res.favicon(favicon) : res.error(new Error("favicon not found"));
});

app.use(Router);
////////

app.start();