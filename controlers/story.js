var util = require('util');
var jsdom = require('jsdom');
var _ = require('underscore');
var config = require('../config');
var storyModel = new (require('../models/StoryModel'))();

function error(req, res, status, err) {
    if(arguments.length == 3) {
        err = status;
        status = 500;
    }
    console.log(err);
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


module.exports = {

    idMatcher: function(req, res, next, id){
        if(parseInt(id) == id) {
            next();
        } else {
            next('route');
        }
    },

    getById: function(req, res) {
        storyModel.get(req.params.id).on('data', function(row) {
            res.format({
                html: function() {
                    res.render('story', _.defaults(row, config.templateData));
                },
                json: function() {
                    res.send(row);
                }
            });
        }).on('error', function(err){
                if(err instanceof storyModel.NoRowsError) {
                    res.status('404').render('404', config.templateData);
                } else {
                    console.log('getById database error: ', err);
                    res.send(500, err);
                }
        });
    },

    // fb likes to POST to the redirect url
    // /story/28?post_id=100001635164962_548726125142879
    postById: function(req, res) {
        if (req.query.post_id) {
            // the user posted this story to his or her wall
            storyModel.addFbPostId(req.params.id, req.query.post_id);
        }
        res.redirect(req.query.redirect_ur || '/story/' + req.params.id);
    },

    postNew: function(req, res) {
        req.body.account_id = req.account.id;

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

        storyModel.new(req.body).on('data', function(result) {
            console.log('post saved and database row found: ', result);
            var read_post_url = (process.env.FB_APP_URL || "https://apps.facebook.com/extendedposts/") + "story/" +  result.id;
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

//            var formats = {
//                text: function(){
//                    res.type('.txt').send(post_to_fb_url);
//                },
//                html: function(){
//                    res.redirect(post_to_fb_url);
//                },
//                json: function(){
//                    res.jsonp({success: true, post_to_fb_url: post_to_fb_url});
//                }
//            };
//            if (req.body.format && formats[req.body.format]) {
//                formats[req.body.format]();
//            } else {
//                res.format(formats);
//            }

            res.send({success: true, post_to_fb_url: post_to_fb_url});

        }).on('error', function(err){
                return(error(req, res, 500, err));
        });
    }
};

function getText(body) {
    var window = jsdom.jsdom('<html><head></head><body><div id="container"></div></body></html>').createWindow();
    var container = window.document.getElementById('container');
    container.innerHTML = body;
    return container.textContent;
}
