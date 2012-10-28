var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;

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
    var jsdom = require('jsdom');
    var util = require('util');

    var Posts = require('./PostModel');
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
        res.render('index', addTemplateGlobals({title: "Post beautiful stories to Facebook's Timeline"}));
    });

    // fb likes to issue POST requests to the home page
    app.post('/', function(req, res) {
        res.redirect('/');
    });

    app.get(/(about|pricing|docs)/, function(req, res) {
        var page = req.params[0];
        res.render(page, addTemplateGlobals());
    });

    app.get('/post/new', function(req, res) {
        res.render('new_post', addTemplateGlobals({}));
    });

    app.param('id', function(req, res, next, id){
        console.log(id, typeof id, parseInt(id), parseInt(id) == id)
        if(parseInt(id) == id) {
            next();
        } else {
            next('route');
        }
    });

    app.get('/post/:id', function(req, res) {
        Posts.get(req.params.id).on('data', function(row) {
            res.render('post', addTemplateGlobals(row));
        }).on('error', function(err){
            if(err instanceof Posts.NoRowsError) {
                res.status('404').render('404', addTemplateGlobals());
            } else {
                res.send(500, err);
            }
        });
    });

    function error(req, res, status, err) {
        if(arguments.length == 3) {
            err = status;
            status = 500;
        }
        res.status(status);
        if (!err instanceof Error) {
            err = new Error(err)
        }
        var formats = {
            text: function(){
                res.type('.txt').send(err.message);
            },
            html: function(){
                res.type('.txt').send(err.message); // I don't feel like writing HTML files for errors...
            },
            json: function(){
                res.json({success: false, error: err});
            }
        };
        if (req.param('format') == 'json') {
            formats.json(err);
        } else {
            res.format(formats);
        }
    }

    // fb likes to POST to the redirect url
    // /post/28?post_id=100001635164962_548726125142879
    app.post('/post/:id', function(req, res) {
        if (req.query.post_id) {
            // the user posted this story to his or her wall
            Posts.addFbPostId(req.params.id, req.query.post_id);
        }
        res.redirect(req.query.redirect_ur || '/post/' + req.params.id);
    });

    app.post('/post/new', function(req, res) {

        try {
            ['name','picture','body'].forEach(function(field) {
                if (!req.body[field]) {
                     throw "Error: missing required field: " + field;
                }
            });
        } catch(ex) {
            return error(req, res, 400, ex);
        }

        var caption = req.body.caption || '';
        var description = req.body.description || '';

        if(caption.length > 80) {
            return error(req,res,400,"caption must be 80 characters or less");
        }
        if(description.length > 320) {
            return error(req,res,400,"caption must be 80 characters or less");
        }

        if(!caption && !description) {
            var text = getText(req.body.body).substr(0, 400);
            console.log('got text', text);
            var paragraphs = text.replace(/[\r\n]/g, '\n')
                .split('\n')
                .filter(function(para){
                    return para.trim();
                })
                .slice(0,2).map(function(para){
                    return para.replace(/\s+/g, ' ');
                });
            console.log('paragraphs', paragraphs);
            if (paragraphs.length >= 2 && paragraphs[0].length <= 80) {
                caption = paragraphs.shift();
            } else {
                caption = '';
            }
            if (paragraphs.length >= 1) {
                if (paragraphs[0].length < 320) {
                    description = paragraphs[0];
                } else {
                    description = paragraphs[0].substr(0,317) + "...";
                }
            }
        }
        caption = caption || ' ';

        Posts.new(req.body).on('data', function(result) {
            console.log('post saved and database row found: ', result);
            var read_post_url = (process.env.FB_APP_URL || "https://apps.facebook.com/extendedposts/") + "post/" +  result.id;
            var redirect_url = read_post_url;
            if (req.body.redirect_url) {
               redirect_url +='?redirect_url=' + req.body.redirect_url;
            }
            var post_to_fb_url = util.format('https://www.facebook.com/dialog/feed?app_id=%s&link=%s&picture=%s&name=%s&caption=%s&description=%s&redirect_uri=%s&properties=%s%s',
                process.env.FB_APP_ID || '458521630865987',
                encodeURIComponent(read_post_url),
                encodeURIComponent(req.body.picture),
                encodeURIComponent(req.body.name),
                encodeURIComponent(caption),
                encodeURIComponent(description),
                encodeURIComponent(redirect_url),
                encodeURIComponent(JSON.stringify({' ':{text: 'Continue reading...', href:read_post_url}})),
                encodeURIComponent((req.body.actions) ? '&actions=' + req.body.actions : '')
            );

            var formats = {
                text: function(){
                    res.type('.txt').send(post_to_fb_url);
                },
                html: function(){
                    res.redirect(post_to_fb_url);
                },
                json: function(){
                    res.jsonp({success: true, post_to_fb_url: post_to_fb_url});
                }
            };
            if (req.body.format && formats[req.body.format]) {
                formats[req.body.format]();
            } else {
                res.format(formats);
            }

        }).on('error', function(err){
            return(error(req, res, 500, err));
        });
    });

    app.listen(app.get('port'), function(){
        console.log("ExtendedPosts server listening on port " + app.get('port'));
    });

    function addTemplateGlobals(data) {
        data = data || {};
        data.title = data.title || "ExtendedPosts";
        data.gaId = process.env.GA_ID || false;
        data.environment = process.env.NODE_ENV || 'development';
        data.fb_app_id = process.env.FB_APP_ID || "458521630865987";
        return data;
    }

    function getText(body) {
        if(body.indexOf('<') == -1) {
            return body;
        }
        var window = jsdom.jsdom('<html><head></head><body><div id="container"></div></body></html>').createWindow();
        var container = window.document.getElementById('container');
        container.innerHTML = body;
        return container.textContent;
    }

}
