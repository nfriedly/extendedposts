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



var self = module.exports = {

    idMatcher: function(req, res, next, id) {
        if(parseInt(id) == id) {
            next();
        } else {
            next('route');
        }
    },

    get: function(req, res) {
        async.parallel({
            story: function(next) {
                storyModel.get(req.params.id, next);
            },
            variations: function(next) {
                storyModel.getVariations(req.params.id, next);
            }
        }, function(err, results) {
            if (err) {
                return res.status(err instanceof storyModel.NoRowsError ? 400 : 500).send({success: false, error: err});
            }
            var story = _.pick(results.story, 'id', 'name', 'caption', 'description', 'body');
            story.variations = _.map(results.variations, function(row) {
                return _.pick(row, 'id', 'name', 'caption', 'description', 'body', 'variation_of');
            });
            res.send(story);
        });
    },

    viewById: function(req, res) {
        storyModel.get(req.params.id).on('data', function(row) {
            res.render('story', _.defaults(row, config.templateData));
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
    postFBPostID: function(req, res) {
        if (req.query.post_id) {
            // the user posted this story to his or her wall
            storyModel.addFbPostId(req.params.id, req.query.post_id);
        }
        res.redirect(req.query.redirect_ur || '/story/' + req.params.id);
    },

    post: function(req, res) {
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
        caption = caption || null;

        storyModel.new(req.body).on('data', function(result) {
            console.log('post saved and database row found: ', result);
            var read_post_url = config.FB_APP_URL + "story/" +  result.id;

            res.send({success: true, read_story: read_post_url, post_story: util.format("http://%s/story/%s/post", req.host, result.id)});

        }).on('error', function(err){
                return(error(req, res, 500, err));
        });
    },

    // end-users come here on their way to facebook

    // gets one story variation, redirects user, then updates hit count
    getPostStory: function(req, res) {

        storyModel.getRandomVariation(req.params.id, function(err, story) {
            if (err) {
                console.error(err);
                return res.redirect('https://www.facebook.com/');
            }

            var read_post_url = self.getViewUrl(story);
            var redirect_url = read_post_url;
            //if (req.body.redirect_url) {
            //    redirect_url +='?redirect_url=' + req.body.redirect_url;
            //}
            var post_to_fb_url = util.format('https://www.facebook.com/dialog/feed?app_id=%s&link=%s&picture=%s&name=%s&caption=%s&description=%s&redirect_uri=%s&properties=%s%s',
                process.env.FB_APP_ID || '458521630865987',
                encodeURIComponent(read_post_url),
                encodeURIComponent(story.picture),
                encodeURIComponent(story.name),
                encodeURIComponent(story.caption || ' '),
                encodeURIComponent(story.description),
                encodeURIComponent(redirect_url),
                encodeURIComponent(JSON.stringify({' ':{text: 'Continue reading...', href:read_post_url}}))//,
                //encodeURIComponent((req.body.actions) ? '&actions=' + req.body.actions : '')
            );

            res.redirect(post_to_fb_url);

            storyModel.incrementPosts(story.id).on('error', console.error);
        });
    },

    postVariation: function(req, res) {
        storyModel.addVariation(req.params.id, req.body).on('data', function(id) {
            res.redirect(util.format('/story/%s/variation/%s', req.params.id, id));
        }).on('error', function(err){
            res.status(500).send({success: false, error: err});
        });
    },

    delete: function(req, res) {
        storyModel.delete(req.body.id).on('data', function() {
            res.send({success: true});
        }).on('error', function(err) {
            res.send({success: false, error: err});
        });
    },

    getViewUrl: function(story) {
        return config.FB_APP_URL + "story/" +  story.id;
    }
};

function getText(body) {
    var window = jsdom.jsdom('<html><head></head><body><div id="container"></div></body></html>').createWindow();
    var container = window.document.getElementById('container');
    container.innerHTML = body;
    return container.textContent;
}
