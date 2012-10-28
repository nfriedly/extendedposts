var Stream = require('stream');
var pg = require('pg');

function NoRowsError(){
    Error.call(this, "No rows returned");
}
NoRowsError.prototype = new Error();
module.exports.NoRowsError = NoRowsError;

var DB_URL = process.env.DATABASE_URL || "tcp://postgres:1234@localhost/postgres";
console.log('about to connect to db:', DB_URL);
var client = new pg.Client(DB_URL);
client.connect(function(err, client) {
    if (err) {
        console.error('error connecting to database:', err);
    } else {
        console.log('database connection successful!');
    }
});

client.query('CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, name varchar(100) NOT NULL, body text NOT NULL)').on('error', console.error);

function queryToStream(query) {
    var res = new Stream();
    res.readable = true;
    res.writeable = false;

    query.on('row', function(row) {
        res.emit('data',row);
    });

    query.on('error', function(err) {
        res.emit('error', err);
    });

    query.on('end', function(result) {
        if(result.rowCount == 0) {
            res.emit('error', new NoRowsError())
        }
        res.emit('end', result);
    });

    return res;
}

module.exports.get = function(id) {
    return queryToStream(client.query('SELECT * FROM posts WHERE id=$1', [id]));
};

module.exports.new = function(data) {
    var res = new Stream();
    res.readable = true;
    res.writeable = true;

    var query = client.query("INSERT INTO posts (name, body) VALUES ($1, $2)", [data.name, data.body]);

    query.on('error', function(err) {
        res.emit('error', err);
    });

    query.on('end', function(result) {
        if (!result.rowCount) {
            res.emit('error', 'Post was not saved');
            res.emit('end');
        } else {
            queryToStream(client.query("SELECT currval(pg_get_serial_sequence('posts', 'id')) as id"))
                .on('data', function(data) { res.emit('data', data); })
                .on('error', function(err) { res.emit('error', err); });
        }
    });

    return res;
};

module.exports.update = function(id, data) {

};
