var config = require('../config');
var pg = require('pg');

/*
 * One shared DB client per thread
 *
 * the pg client queues requests, so you can hit it before it's finished connecting
 */
var client = new pg.Client(config.DB_URL);

console.log('about to connect to db:', config.DB_URL);

client.connect(function(err, client) {
    if (err) {
        console.error('error connecting to database:', err);
    } else {
        console.log('database connection successful!');
    }
});

module.exports = client;
