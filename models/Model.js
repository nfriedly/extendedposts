var Stream = require('stream');
var util = require("util");
var _ = require('underscore');
var client = require('./client');

var Model = function(table, fields) {
    this.table = table;
    this.fields = fields;

    var self = this;

    // set up the stored procedure for getById
    client.query({
        name: this.table + 'getById',
        text: util.format('SELECT * FROM %s WHERE id=$1', this.table),
        values: [0]
    });

    self.get = function(id, callback) {
        return self.queryToStream(client.query({
            name: self.table + 'getById',
            values: [id]
        }), callback);
    };

    var INSERT_QUERY = util.format(
        'INSERT INTO %s (%s) VALUES (%s)',
        self.table,
        self.fields.join(', '),
        _.range(1, self.fields.length+1).map(function(num){ return "$"+num; }).join(", ")
    );

    // returns the correct fields in the correct order for the INSERT_QUERY
    function formatForInsert(data) {
        var res = [];
        self.fields.forEach(function(field) {
            res.push(data[field] || null);
        });
        return res;
    }

    var INSERT_ID_QUERY = util.format("SELECT currval(pg_get_serial_sequence('%s', 'id')) as id", this.table);

    self.new = function(data, callback) {
        var res = new Stream();
        res.readable = true;
        res.writeable = true;

        var query = client.query(INSERT_QUERY, formatForInsert(data));

        query.on('error', function(err) {
            res.emit('error', err);
        });

        query.on('end', function(result) {
            if (!result || !result.rowCount) {
                res.emit('error', 'Post was not saved');
                res.emit('end');
            } else {
                self.queryToStream(client.query(INSERT_ID_QUERY))
                    .on('data', function(data) { res.emit('data', data); })
                    .on('error', function(err) { res.emit('error', err); });
            }
        });

        self.subscribeCallback(res, callback);

        return res;
    };

    self.update = function(id, data, callback) {
        var fields = [];
        var i = 0;
        _.each(data, function(value, key) {
            i++;
            fields.push(util.format('%s = $%s', key, i));
        });
        var query = util.format("UPDATE %s SET %s WHERE id= %s",
            self.table,
            fields.join(', '),
            id
        );
        return self.queryToStream(pg.query(query), callback);
    };

    self.queryToStream = function(query, callback) {
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
            if(result && result.rowCount == 0) {
                res.emit('error', new self.NoRowsError())
            }
            res.emit('end', result);
        });

        self.subscribeCallback(res, callback);

        return res;
    }

};

module.exports = Model;

Model.prototype.subscribeCallback = function(stream, callback) {
    if (!callback) {
        return;
    }
    stream.on('data', function(res) {
        callback(null, res);
    }).on('error', callback);
};

Model.prototype.NoRowsError = function() {
    Error.call(this, "No rows returned");
};
Model.prototype.NoRowsError.prototype = new Error();


