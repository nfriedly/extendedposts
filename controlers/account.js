var _ = require('underscore');
var config = require('../config');
var accountModel = new (require('../models/AccountModel'))();
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
                accountModel.new(req.body).on('data', function(user_id) {
                    user_data.id = user_id;
                    next(null, user_data);
                }).on('error', function(err) {
                    next(err);
                });
            }],
            randomBytes: function(next) {
                crypto.randomBytes(12, next);
            },
            saveAPiKey: ["saveUser", "randomBytes", function (next, results) {
                user_data.api_key = "ep_" + user_data.id +"_" + results.randomBytes.toString('hex');
                accountModel.update(user_data.id, {api_key: user_data.api_key}, next);
            }],
            redirect: ["saveAPiKey", function (next, results) {
                req.session.account = user_data;
                res.redirect('/account');
            }]

        }, function(err){
            console.error(err);
            res.status(500).type('.txt').send('Error creating your account');
    });
};

module.exports.getLogin = function(req, res) {
    res.render('account_login', config.templateData);
};

module.exports.postLogin = function(req, res) {
    if (!req.body.email || !req.body.password) {
        req.redirect('/account/login?error=blank');
    } else {
        accountModel.getByEmail(req.body.email)
            .on('data', function(user) {
                crypto.pbkdf2(req.body.password, user.password_salt , 100000, 100, function(err, pass_bits) {
                    if (err) {
                        console.error('error during login', err);
                        res.redirect('/account/login?error=internal');
                        return;
                    }
                    if (new Buffer(pass_bits, 'binary').toString('base64') == user.password_hash) {
                        delete user.password_hash;
                        delete user.password_salt;
                        req.session.account = user;
                        res.redirect('/account');
                    } else {
                        res.redirect('/account/login?error=invalid');
                    }
                });
            }).on('error', function(err) {
                if (err instanceof accountModel.NoRowsError ) {
                    res.redirect('/account/login?error=invalid');
                } else {
                    console.error('error during login', err);
                    res.redirect('/account/login?error=internal');
                }
            });
    }
};

module.exports.authenticateUser = function(req, res, next) {
    if (!req.session || !req.session.account) {
        res.redirect('/account/login');
    } else {
        next();
    }
};

module.exports.get = function(req, res) {
    res.render('account', _.defaults(req.session, config.templateData));
};

module.exports.authenticateApiKey = function(req, res, next) {
    var api_key = req.param('api_key');
    console.log('authing by api key', api_key);
    if(!api_key) {
        res.status(401).send({success: false, error: "api_key field is required"});
    }
    accountModel.getByApiKey(api_key, function(err, account) {
        if (err) {
            if (err instanceof  accountModel.NoRowsError) {
                res.status(401).send({success: false, error: 'api_key does not appear to be valid'});
            }
            console.error(err);
            res.status(500).send({success: false, error: 'Error finding account'});
            return;
        }
        console.log('account found', account);
        req.account = account;
        next()
    });
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
