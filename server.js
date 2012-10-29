var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;
var config = require('./config');

if (cluster.isMaster) {
    // Fork workers.
    for (var i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('death', function(worker) {
        console.log('worker ' + worker.pid + ' died');
    });
} else {

    var express = require('express');
    var _ = require('underscore');
    var path = require('path');

    var app = express();

    app.configure('development', function(){
        app.use(express.errorHandler());
        app.use(express.logger('dev'));
    });

    app.configure('production', function(){
        app.use(express.compress());
    });

    app.configure(function(){
        app.set('port', process.env.PORT || 3000);
        app.set('views', __dirname + '/views');
        app.set('view engine', 'jade');
        app.use(express.bodyParser());
        var METHOD_KEY = "method";
        app.use(function methodOverride(req, res, next) {
            req.originalMethod = req.originalMethod || req.method;

            // req.body
            if (req.body && METHOD_KEY in req.body) {
                req.method = req.body[METHOD_KEY].toUpperCase();
                delete req.body[METHOD_KEY];

            // req.query
            } else if (req.query && METHOD_KEY in req.query) {
                req.method = req.query[METHOD_KEY].toUpperCase();
                delete req.query[METHOD_KEY]
                if (req.method != "GET") {
                    req.body = req.query;
                    // delete req.query; // can't do this because the jsonp doce depends on req.query
                }

            // check X-HTTP-Method-Override
            } else if (req.headers['x-http-method-override']) {
                req.method = req.headers['x-http-method-override'].toUpperCase();
            }

            next();
        });
        app.use(app.router);
        app.use(require('less-middleware')({ src: __dirname + '/public' }));
    });

    app.configure('development', function(){
        app.use(express.static(path.join(__dirname, 'public')));
    });

    var oneDay = 86400000;
    app.configure('production', function(){
        app.use(express.static(path.join(__dirname, 'public'), { maxAge: oneDay }));
    });

    // todo: add authentication
    // todo: add billing
    // todo: add like and comments

    app.get('/', function(req, res) {
        res.render('index', _.defaults({title: "Post beautiful stories to Facebook's Timeline"}, config.templateData));
    });

    // fb likes to issue POST requests to the home page
    app.post('/', function(req, res) {
        res.redirect('/');
    });

    app.get(/(about|plans|docs)/, function(req, res) {
        var page = req.params[0];
        res.render(page, config.templateData);
    });

    var account = require('./controlers/account');
    app.get('/account/new', account.getNew);
    app.post('/account/new', account.postNew);
    app.get('/account', account.get);

    var post = require('./controlers/post');
    app.get('/post/new', post.getNew);
    app.param('id', post.idMatcher);
    app.get('/post/:id', post.getById);
    app.post('/post/:id', post.postById);
    app.post('/post/new', post.postNew);

    app.listen(app.get('port'), function(){
        console.log("ExtendedPosts server listening on port " + app.get('port'));
    });

}
