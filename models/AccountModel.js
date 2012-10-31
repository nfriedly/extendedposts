var util = require('util');
var Stream = require('stream');
var Model = require('./Model');
var client = require('./client');

function UserModel() {
    Model.call(this, 'account', ['name', 'email', 'password_salt', 'password_hash', 'stripe_id', 'stripe_plan']);

    var self = this;

    self.getByApiKey = function(api_key, callback) {
        return self.queryToStream(client.query('SELECT * FROM account WHERE api_key=$1', [api_key]), callback);
    };

    self.getByEmail = function(email, callback) {
        return self.queryToStream(client.query('SELECT * FROM account WHERE email=$1', [email]), callback);
    };
}

util.inherits(UserModel, Model);

module.exports = UserModel;






