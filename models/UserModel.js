var util = require('util');
var Stream = require('stream');
var Model = require('./Model');
var client = require('./client');

function UserModel() {
    Model.call(this, 'posts', ['name', 'email', 'password_salt', 'password_hash', 'stripe_id', 'stripe_plan']);

    var self = this;

//    self.get = function(id) {
//        return queryToStream(client.query('SELECT * FROM users WHERE id=$1', [id]));
//    };
//
//    self.new = function(data) {
//        var res = new Stream();
//        res.readable = true;
//        res.writeable = true;
//
//        var query = client.query('INSERT INTO users (name, email, password_salt, password_hash, stripe_id, stripe_plan) VALUES ($1, $2, $3, $4, $5, $6)',
//            [data.name, data.email, data.password_salt, data.password_hash, data.stripe_id, data.stripe_plan]);
//
//        query.on('error', function(err) {
//            res.emit('error', err);
//        });
//
//        query.on('end', function(result) {
//            if (!result || !result.rowCount) {
//                res.emit('error', 'Post was not saved');
//                res.emit('end');
//            } else {
//                self.queryToStream(client.query("SELECT currval(pg_get_serial_sequence('users', 'id')) as id"))
//                    .on('data', function(data) { res.emit('data', data); })
//                    .on('error', function(err) { res.emit('error', err); });
//            }
//        });
//
//        return res;
//    };
}

util.inherits(UserModel, Model);

module.exports = UserModel;






