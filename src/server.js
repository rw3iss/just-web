import Application from './lib/application';
import Router from './lib/router';
//const { print } = just;

Router.get('/test', function(req, res) {
    let data = {
        something: "test"
    };

    res.json(data);
});

let app = new Application();

app.use(Router);

app.start();