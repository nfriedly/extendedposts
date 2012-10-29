var _ = require('underscore');
var config = require('../config');
var Users = new (require('../models/UserModel'))();
var stripe = require('stripe')(config.STRIPE_PRIVATE_KEY);
var async = require('async');
var crypto = require('crypto');

module.exports.getNew = function(req, res) {
    var templateData = _.defaults({
        plan: req.query.plan || false
    }, config.templateData);
    res.render('account_new', templateData)
};

module.exports.postNew = function(req, res) {
    var user_data = req.body;

    // this thing is kind of magical.. you tell it the dependencies and it runs as much stuff in parallel as possible!
    // although it seems to like to retry things once if something fails - hence the _.once
    async.auto({
            stripeCustomer: _.once(function(next) {
                console.log("creating stripe customer");
                stripe.customers.create({
                        email: req.body.email,
                        plan: req.body.stripe_plan,
                        card: req.body.stripe_token
                    }, next);
            }),
            hashPassword: function(next) {
                hashPassword(user_data, user_data.password, next)
            },
            saveUser: ["hashPassword", "stripeCustomer", function (next, results) {
                user_data.stripe_id = results.stripeCustomer.id;
                console.log("customer id", user_data.stripe_id);
                Users.new(req.body).on('data', function(user_id) {
                    user_data.id = user_id;
                    next(null, user_data);
                }).on('error', function(err) {
                    next(err);
                });
            }],

    //        function getRandomBytes(next) {
    //            crypto.randomBytes(12, next)
    //        }, function createAPIKey(bytes, next) {
    //            user.api_key = ""
    //        }
            redirect: ["saveUser", function (next, results) {
                // todo: log user in
                res.redirect('/account');
            }]

        }, function(err){
            console.error(err);
            res.status(500).type('.txt').send('Error creating your account');
    });
};


module.exports.get = function(req, res) {
    res.type('.txt').send('Hi!');
};


// loosely bassed on http://stackoverflow.com/questions/11557467/node-js-crypto-pbkdf2-password-to-hex
// and http://codereview.stackexchange.com/questions/12330/node-js-password-salting-hashing

function hashPassword(user, password, callback) {
    crypto.randomBytes(256, function(err, salt_buff) {
        if (err) {
            callback(err);
            return;
        }
        user.password_salt = salt_buff.toString('base64');
        crypto.pbkdf2(password, user.password_salt , 100000, 100, function(err, pass_bits) {
            if (err) {
                callback(err);
                return;
            }
            user.password_hash = new Buffer(pass_bits, 'binary').toString('base64');
            callback(null, user);
        });
    });
}
