var util = require('util');
var Model = require('./Model');
var Stream = require('stream');
var client = require('./client');

function PostModel() {
    Model.call(this, 'posts', ['user_id', 'name', 'body', 'caption', 'description']);

    var self = this;
    // getById(), new(), and update() are all created automatically by Model

    self.addFbPostId = function(id, fb_post_id) {
        var res = new Stream();
        res.readable = true;
        res.writeable = true;

        var query = client.query("INSERT INTO fb_posts (post_id, fb_post_id) VALUES ($1, $2)", [id, fb_post_id]);

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

}

util.inherits(PostModel, Model);

module.exports = PostModel;


