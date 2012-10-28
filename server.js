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
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(require('less-middleware')({ src: __dirname + '/public' }));
    app.use(express.static(path.join(__dirname, 'public')));
});

// todo: add www-redirection and Cache-Control: max-age=(seconds) headers

app.get('/', function(req, res) {
    res.render('index', addTemplateGlobals({}));
});

// fb likes to issue POST requests to the home page
app.post('/', function(req, res) {
    res.render('index', addTemplateGlobals({}));
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

app.post('/post/new', function(req, res) {
    var caption = req.body.caption || '';
    var description = req.body.description || '';
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
            caption = paragraphs.pop();
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
        var post_to_fb_url = util.format('https://www.facebook.com/dialog/feed?app_id=%s&link=%s&picture=%s&name=%s&caption=%s&description=%s&redirect_uri=%s&properties=%s%s',
            process.env.FB_APP_ID || '458521630865987',
            encodeURIComponent(read_post_url),
            encodeURIComponent(req.body.picture),
            encodeURIComponent(req.body.name),
            encodeURIComponent(caption),
            encodeURIComponent(description),
            encodeURIComponent(req.body.redirect_url || read_post_url),
            encodeURIComponent(JSON.stringify({' ':{text: 'Continue reading...', href:read_post_url}})),
            encodeURIComponent((req.body.actions) ? '&actions=' + req.body.actions : '')
        );
        res.redirect(post_to_fb_url);
    }).on('error', function(err){
        res.send(500, err)
    });
});

app.listen(app.get('port'), function(){
    console.log("ExtendedPosts server listening on port " + app.get('port'));
});

function addTemplateGlobals(data) {
    data = data || {};
    data.gaId = process.env.GA_ID || false;
    data.environment = process.env.NODE_ENV || 'development';
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
