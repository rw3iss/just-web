import Application from './lib/application';
import Router from './lib/router';
//const { print } = just;

let app = new Application();

Router.get('/test', function(req, res) {
    let data = {
        something: "test"
    };

    res.json(data);
});

Router.get('/', function(req, res) {
    res.send('Home!');
});

app.use(Router);

app.start();