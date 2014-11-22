var util = require('util');
var Stream = require('stream');
var domain = require('domain');
var _ = require('underscore');
var Model = require('./Model');
var client = require('./client');

function StoryModel() {
    Model.call(this, 'story', ['account_id', 'name', 'body', 'caption', 'description']);

    var self = this;
    // getById(), new(), and update() are all created automatically by Model

    self.addFbPostId = function(id, fb_post_id) {
        var res = new Stream();
        res.readable = true;
        res.writeable = true;

        var query = client.query("INSERT INTO fb_post (story_id, fb_post_id) VALUES ($1, $2)", [id, fb_post_id]);

        query.on('error', function(err) {
            res.emit('error', err);
        });

        query.on('end', function(result) {
            if (!result.rowCount) {
                res.emit('error', 'Post was not saved');
            }
            res.emit('end');
        });

        return res;
    };

    self.addVariation = function(source_id, data) {
        var res = new Stream();
        res.readable = true;
        res.writeable = true;

        var addVariationDomain = domain.create();

        addVariationDomain.on('error', function(e) {
            console.error(e);
            res.emit('error', e);
        });

        addVariationDomain.run(function() {
            self.getById(source_id).on('data', function(source){
                _.defaults(data, source);

                data.variation_of = source_id;
                delete data.created_at;
                delete data.updated_at;

                var query = self.new(data);

                query.on('end', function(result) {
                    if (!result.rowCount) {
                        res.emit('error', 'Post was not saved');
                    }
                    res.emit('end');
                });
            });
        });

        return res;
    };

    self.getVariations = function(source_id, callback) {
        return self.query("SELECT * FROM story WHERE variation_of=$1", [source_id], callback);
    };

    self.getRandomVariation = function(source_id, callback) {
        return self.query("SELECT * FROM story WHERE id=$1 OR variation_of=$1 order by random() limit 1", [source_id], callback);
    };

    self.incrementPosts = function(id, callback) {
        return self.query("UPDATE story SET post_starts=post_starts+1 WHERE id=$1", [id], callback);
    };

    self.incrementViews = function(id, callback) {
        return self.query("UPDATE story SET views=views+1 WHERE id=$1", [id], callback);
    };

    self.getPostCompletions = function(id, callback) {
        return self.query("SELECT COUNT (*) as post_completions FROM fb_post WHERE story_id=$1", [id], callback);
    }
}

util.inherits(StoryModel, Model);

module.exports = StoryModel;


